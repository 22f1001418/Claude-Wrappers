"""Email notification Celery tasks for daily reports and workspace digests."""

from datetime import date, datetime, time as time_of_day, timedelta
from html import escape

from sqlalchemy import func

from flask import current_app

from flask_app.celery_app import celery
from flask_app.extensions import cache
from flask_app.models.models import db
from flask_app.models.models import Bill, Inventory, Note, Product, Sale, Todo, UserDetail
from flask_app.utils.email_utils import send_email

ALLOWED_REPORT_TIMES = {
    "same_day": {f"{hour:02d}:{minute:02d}" for hour in range(18, 23) for minute in (0, 30)} | {"23:00"},
    "next_day": {f"{hour:02d}:{minute:02d}" for hour in range(6, 11) for minute in (0, 30)},
}


def _resolve_user_schedule(user):
    day_mode = user.daily_report_day_mode or "same_day"
    if day_mode not in ALLOWED_REPORT_TIMES:
        day_mode = "same_day"

    default_time = "20:30" if day_mode == "same_day" else "08:00"
    report_time = user.daily_report_time or default_time
    if report_time not in ALLOWED_REPORT_TIMES[day_mode]:
        report_time = default_time

    return day_mode, report_time


def _resolve_report_date(today, day_mode):
    if day_mode == "next_day":
        return today - timedelta(days=1)
    return today


def _resolve_low_stock_threshold(user):
    configured = getattr(user, "low_stock_threshold", None)
    if configured is None:
        configured = current_app.config.get("CELERY_LOW_STOCK_THRESHOLD", 10)
    try:
        return max(1, int(configured))
    except (TypeError, ValueError):
        return 10


def _fmt_currency(value):
        return f"Rs {int(value or 0):,}"


def _build_workspace_digest_text(user, report_date):
        due_today_todos = Todo.query.filter_by(
                username=user.username,
                date=report_date,
                completed=False,
        ).order_by(Todo.priority.desc(), Todo.time.asc()).all()
        due_today = len(due_today_todos)
        open_todos = Todo.query.filter_by(username=user.username, completed=False).count()
        note_count = Note.query.filter_by(username=user.username).count()

        if due_today_todos:
                due_today_lines = [
                        f"- {todo.title} | Priority: {todo.priority} | Time: {todo.time or 'N/A'} | Category: {todo.category}"
                        for todo in due_today_todos
                ]
                due_today_section = "\n".join(due_today_lines)
        else:
                due_today_section = "- No tasks due today"

        subject = f"VyaparAI workspace notification ({report_date.isoformat()})"
        body = (
                f"Hello {user.full_name or user.username},\n\n"
                f"Workspace snapshot for {report_date.isoformat()}:\n"
                f"- Open todos: {open_todos}\n"
                f"- Todos due today: {due_today}\n"
                f"- Total notes: {note_count}\n\n"
                "Due today task details:\n"
                f"{due_today_section}\n\n"
                "Open your workspace to review pending tasks."
        )
        return subject, body


def _build_workspace_todo_reminder_text(user, todo, report_date):
        subject = f"VyaparAI todo reminder - {todo.title}"
        body = (
                f"Hello {user.full_name or user.username},\n\n"
                "This is a reminder that the following task is due in about 15 minutes:\n"
                f"- Title: {todo.title}\n"
                f"- Date: {report_date.isoformat()}\n"
                f"- Time: {todo.time or 'N/A'}\n"
                f"- Priority: {todo.priority}\n"
                f"- Category: {todo.category}\n\n"
                "Please open your workspace and complete it on time."
        )
        return subject, body


@celery.task(name="flask_app.tasks.notifications.send_new_cashier_credentials_email")
def send_new_cashier_credentials_email(cashier_email, cashier_username, plaintext_password, owner_name=None):
        """Send onboarding credentials email to a newly created cashier."""

        if not cashier_email or not cashier_username or not plaintext_password:
            return {
                "sent": 0,
                "error": "cashier_email, cashier_username, and plaintext_password are required",
            }

        subject = "VyaparAI cashier account created"
        owner_label = owner_name or "your manager"
        body = (
            f"Hello {cashier_username},\n\n"
            f"A cashier account has been created for you by {owner_label}.\n"
            "Use the credentials below to sign in:\n"
            f"- Username: {cashier_username}\n"
            f"- Temporary password: {plaintext_password}\n\n"
            "Please sign in and change your password immediately."
        )

        ok, err = send_email(subject, [cashier_email], body)
        return {
            "sent": 1 if ok else 0,
            "cashier": cashier_username,
            "recipient": cashier_email,
            "error": err,
        }


def _todo_clock_value(raw_time):
        """Parse todo time into a clock value. Supports 24h and common 12h formats."""

        if not raw_time:
                return None

        normalized = str(raw_time).strip().upper().replace(".", "")
        candidate_formats = ["%H:%M", "%I:%M %p", "%I:%M%p"]
        for fmt in candidate_formats:
                try:
                        return datetime.strptime(normalized, fmt).time()
                except ValueError:
                        continue
        return None


def _cache_key_daily_workspace(user, report_date):
        return f"notif:workspace:daily:{user.username}:{report_date.isoformat()}"


def _cache_key_todo_reminder(todo_id, report_date):
        return f"notif:workspace:todo-reminder:{todo_id}:{report_date.isoformat()}"


def _cache_mark_sent(key):
        """Mark a notification as sent for 48 hours to avoid duplicate emails."""

        cache.set(key, 1, timeout=48 * 60 * 60)


def _cache_sent(key):
        return cache.get(key) is not None


def _build_daily_business_report(user, report_date):
        daily_sales = Sale.query.filter(
                Sale.owner_username == user.username,
                Sale.date_of_purchase == report_date,
        ).order_by(Sale.sale_id.desc()).all()

        transaction_count = len(daily_sales)
        gross_sales = sum(s.total_cost or 0 for s in daily_sales)
        amount_collected = sum(s.amount_paid or 0 for s in daily_sales)
        credit_created = sum(max((s.amount_remaining or 0), 0) for s in daily_sales)
        avg_bill = (gross_sales / transaction_count) if transaction_count else 0

        payment_totals = {"cash": 0, "upi": 0, "credit": 0, "other": 0}
        for sale in daily_sales:
                method = (sale.payment_method or "cash").strip().lower()
                key = method if method in payment_totals else "other"
                payment_totals[key] += sale.total_cost or 0

        unique_customers = len({
                (sale.customer_phone or "").strip() or (sale.customer_name or "").strip().lower()
                for sale in daily_sales
                if (sale.customer_phone or sale.customer_name)
        })

        outstanding_credit = db.session.query(func.sum(Sale.amount_remaining)).filter(
                Sale.owner_username == user.username,
                Sale.amount_remaining > 0,
        ).scalar() or 0

        overdue_credit_count = Sale.query.filter(
                Sale.owner_username == user.username,
                Sale.amount_remaining > 0,
                Sale.due_date.isnot(None),
                Sale.due_date < report_date,
        ).count()

        due_next_day_count = Sale.query.filter(
                Sale.owner_username == user.username,
                Sale.amount_remaining > 0,
                Sale.due_date == (report_date + timedelta(days=1)),
        ).count()

        top_products_rows = db.session.query(
                Bill.product_name,
                func.sum(Bill.units).label("units_sold"),
                func.sum(Bill.units * Bill.unit_price).label("revenue"),
        ).join(
                Sale, Bill.bill_id == Sale.bill_id
        ).filter(
                Sale.owner_username == user.username,
                Sale.date_of_purchase == report_date,
        ).group_by(
                Bill.product_name
        ).order_by(
                func.sum(Bill.units * Bill.unit_price).desc()
        ).limit(5).all()

        top_products = [
                {
                        "name": row.product_name,
                        "units": int(row.units_sold or 0),
                        "revenue": int(row.revenue or 0),
                }
                for row in top_products_rows
        ]

        inventory = Inventory.query.filter_by(username=user.username).first()
        product_count = 0
        low_stock_count = 0
        inventory_value = 0
        low_stock_threshold = _resolve_low_stock_threshold(user)
        if inventory:
                product_count = Product.query.filter_by(inventory_id=inventory.inventory_id).count()
                low_stock_count = Product.query.filter(
                        Product.inventory_id == inventory.inventory_id,
                Product.stock <= low_stock_threshold,
                ).count()
                inventory_value = db.session.query(func.sum(Product.stock * Product.unit_price)).filter(
                        Product.inventory_id == inventory.inventory_id
                ).scalar() or 0

        recent_transactions = daily_sales[:5]

        recipient_name = escape(user.full_name or user.username)
        report_date_label = report_date.strftime("%d %b %Y")

        top_products_html = "".join(
                (
                        "<tr>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7'>{escape(p['name'])}</td>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7;text-align:center'>{p['units']}</td>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7;text-align:right'>{_fmt_currency(p['revenue'])}</td>"
                        "</tr>"
                )
                for p in top_products
        ) or "<tr><td colspan='3' style='padding:12px;color:#64748b'>No product sales on this day.</td></tr>"

        transaction_rows_html = "".join(
                (
                        "<tr>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7'>#{sale.bill_id}</td>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7'>{escape(sale.customer_name or 'Walk-in Customer')}</td>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7;text-align:right'>{_fmt_currency(sale.total_cost)}</td>"
                        f"<td style='padding:10px 8px;border-bottom:1px solid #edf2f7;text-transform:capitalize'>{escape((sale.payment_method or 'cash').lower())}</td>"
                        "</tr>"
                )
                for sale in recent_transactions
        ) or "<tr><td colspan='4' style='padding:12px;color:#64748b'>No transactions to show.</td></tr>"

        html_body = f"""
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1.0' />
    <title>VyaparAI Daily Business Report</title>
</head>
<body style='margin:0;padding:0;background:#f3f5f9;font-family:Segoe UI,Arial,sans-serif;color:#12263a'>
    <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:#f3f5f9;padding:24px 12px'>
        <tr>
            <td align='center'>
                <table role='presentation' width='720' cellspacing='0' cellpadding='0' style='max-width:720px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e9f2'>
                    <tr>
                        <td style='padding:28px 28px 20px;background:linear-gradient(135deg,#0f766e,#0b5c78);color:#ffffff'>
                            <div style='font-size:13px;letter-spacing:0.5px;opacity:0.9'>VyaparAI</div>
                            <div style='font-size:28px;font-weight:700;line-height:1.2;margin-top:8px'>Daily Business Report</div>
                            <div style='font-size:14px;opacity:0.95;margin-top:8px'>Hello {recipient_name}, here is your business summary for {report_date_label}.</div>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:22px 28px 8px'>
                            <div style='font-size:16px;font-weight:700;margin-bottom:12px'>Revenue Snapshot</div>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0'>
                                <tr>
                                    <td style='padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px'>
                                        <div style='font-size:12px;color:#64748b'>Gross Sales</div>
                                        <div style='font-size:22px;font-weight:700;margin-top:4px'>{_fmt_currency(gross_sales)}</div>
                                    </td>
                                    <td width='10'></td>
                                    <td style='padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px'>
                                        <div style='font-size:12px;color:#64748b'>Transactions</div>
                                        <div style='font-size:22px;font-weight:700;margin-top:4px'>{transaction_count}</div>
                                    </td>
                                    <td width='10'></td>
                                    <td style='padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px'>
                                        <div style='font-size:12px;color:#64748b'>Average Bill</div>
                                        <div style='font-size:22px;font-weight:700;margin-top:4px'>{_fmt_currency(avg_bill)}</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:12px 28px'>
                            <div style='font-size:16px;font-weight:700;margin-bottom:12px'>Collection and Credit</div>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0'>
                                <tr>
                                    <td style='padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px'>
                                        <div style='font-size:12px;color:#64748b'>Collected Today</div>
                                        <div style='font-size:20px;font-weight:700;margin-top:4px'>{_fmt_currency(amount_collected)}</div>
                                    </td>
                                    <td width='10'></td>
                                    <td style='padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px'>
                                        <div style='font-size:12px;color:#64748b'>Credit Created Today</div>
                                        <div style='font-size:20px;font-weight:700;margin-top:4px'>{_fmt_currency(credit_created)}</div>
                                    </td>
                                </tr>
                            </table>
                            <div style='font-size:14px;color:#334155;margin-top:10px'>Outstanding credit: <strong>{_fmt_currency(outstanding_credit)}</strong> | Overdue customers: <strong>{overdue_credit_count}</strong> | Due tomorrow: <strong>{due_next_day_count}</strong></div>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:12px 28px'>
                            <div style='font-size:16px;font-weight:700;margin-bottom:10px'>Payment Method Split</div>
                            <div style='font-size:14px;color:#334155;line-height:1.7'>
                                Cash: <strong>{_fmt_currency(payment_totals['cash'])}</strong> | UPI: <strong>{_fmt_currency(payment_totals['upi'])}</strong> | Credit: <strong>{_fmt_currency(payment_totals['credit'])}</strong> | Other: <strong>{_fmt_currency(payment_totals['other'])}</strong>
                            </div>
                            <div style='font-size:14px;color:#334155;margin-top:6px'>Unique customers served: <strong>{unique_customers}</strong></div>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:12px 28px'>
                            <div style='font-size:16px;font-weight:700;margin-bottom:10px'>Top Products (by revenue)</div>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='border:1px solid #e2e8f0;border-radius:10px;overflow:hidden'>
                                <tr style='background:#f8fafc'>
                                    <th align='left' style='padding:10px 8px;font-size:12px;color:#475569'>Product</th>
                                    <th align='center' style='padding:10px 8px;font-size:12px;color:#475569'>Units</th>
                                    <th align='right' style='padding:10px 8px;font-size:12px;color:#475569'>Revenue</th>
                                </tr>
                                {top_products_html}
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:12px 28px'>
                            <div style='font-size:16px;font-weight:700;margin-bottom:10px'>Recent Transactions</div>
                            <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='border:1px solid #e2e8f0;border-radius:10px;overflow:hidden'>
                                <tr style='background:#f8fafc'>
                                    <th align='left' style='padding:10px 8px;font-size:12px;color:#475569'>Bill</th>
                                    <th align='left' style='padding:10px 8px;font-size:12px;color:#475569'>Customer</th>
                                    <th align='right' style='padding:10px 8px;font-size:12px;color:#475569'>Amount</th>
                                    <th align='left' style='padding:10px 8px;font-size:12px;color:#475569'>Method</th>
                                </tr>
                                {transaction_rows_html}
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:12px 28px 24px'>
                            <div style='font-size:16px;font-weight:700;margin-bottom:10px'>Inventory Health</div>
                            <div style='font-size:14px;color:#334155;line-height:1.8'>
                                Product count: <strong>{product_count}</strong><br/>
                                Low stock items (<= {low_stock_threshold}): <strong>{low_stock_count}</strong><br/>
                                Approx inventory value: <strong>{_fmt_currency(inventory_value)}</strong>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td style='padding:14px 28px;background:#f8fafc;color:#64748b;font-size:12px'>
                            You are receiving this email because daily reports are enabled in your VyaparAI settings.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

        subject = f"VyaparAI Daily Business Report - {report_date.isoformat()}"
        text_body = (
                f"Hello {user.full_name or user.username},\n\n"
                f"Daily business report for {report_date.isoformat()}\n"
                f"- Gross sales: {_fmt_currency(gross_sales)}\n"
                f"- Transactions: {transaction_count}\n"
                f"- Average bill: {_fmt_currency(avg_bill)}\n"
                f"- Collected today: {_fmt_currency(amount_collected)}\n"
                f"- Credit created today: {_fmt_currency(credit_created)}\n"
                f"- Outstanding credit: {_fmt_currency(outstanding_credit)}\n"
                f"- Overdue customers: {overdue_credit_count}\n"
                f"- Due tomorrow: {due_next_day_count}\n"
                f"- Unique customers served: {unique_customers}\n"
                f"- Low stock items: {low_stock_count}\n"
                f"- Low stock threshold: {low_stock_threshold}\n"
                f"- Product count: {product_count}\n"
                f"- Inventory value: {_fmt_currency(inventory_value)}\n\n"
                "Open VyaparAI dashboard for complete analytics."
        )

        return subject, text_body, html_body


@celery.task(name="flask_app.tasks.notifications.send_daily_business_report_notifications")
def send_daily_business_report_notifications():
    """Send rich HTML daily business reports based on user schedule settings."""

    now = datetime.now()
    now_time = now.strftime("%H:%M")
    today = now.date()
    users = UserDetail.query.all()
    sent = 0
    opted_out = 0
    skipped_window = 0
    skipped_already_sent = 0
    no_email = 0
    send_failed = 0
    error_samples = []

    for user in users:
        if not user.email:
            no_email += 1
            continue

        if user.daily_report_enabled is False:
            opted_out += 1
            continue

        day_mode, report_time = _resolve_user_schedule(user)
        if now_time != report_time:
            skipped_window += 1
            continue

        report_date = _resolve_report_date(today, day_mode)
        if user.daily_report_last_sent_for_date == report_date:
            skipped_already_sent += 1
            continue

        subject, text_body, html_body = _build_daily_business_report(user, report_date)
        ok, err = send_email(subject, [user.email], text_body, html_body=html_body)
        if ok:
            sent += 1
            user.daily_report_last_sent_for_date = report_date
            db.session.add(user)
        else:
            send_failed += 1
            if len(error_samples) < 5:
                error_samples.append({"username": user.username, "error": err})

    if send_failed:
        current_app.logger.warning(
            "Daily report email failures: %s sample_errors=%s",
            send_failed,
            error_samples,
        )

    if sent:
        db.session.commit()

    return {
        "sent": sent,
        "users_considered": len(users),
        "opted_out": opted_out,
        "skipped_window": skipped_window,
        "skipped_already_sent": skipped_already_sent,
        "no_email": no_email,
        "send_failed": send_failed,
        "error_samples": error_samples,
    }


@celery.task(name="flask_app.tasks.notifications.send_daily_business_report_now")
def send_daily_business_report_now(username=None, email_override=None, report_date_iso=None):
    """Force-send daily business report immediately for testing/debugging."""

    if report_date_iso:
        try:
            report_date = date.fromisoformat(report_date_iso)
        except ValueError:
            report_date = date.today()
    else:
        report_date = date.today()

    query = UserDetail.query
    if username:
        query = query.filter_by(username=username)
    users = query.all()

    sent = 0
    failed = 0
    details = []

    for user in users:
        recipient = email_override or user.email
        if not recipient:
            failed += 1
            details.append({"username": user.username, "status": "failed", "error": "No recipient email"})
            continue

        subject, text_body, html_body = _build_daily_business_report(user, report_date)
        ok, err = send_email(subject, [recipient], text_body, html_body=html_body)
        if ok:
            sent += 1
            details.append({"username": user.username, "status": "sent", "recipient": recipient})
        else:
            failed += 1
            details.append({"username": user.username, "status": "failed", "error": err, "recipient": recipient})

    return {
        "sent": sent,
        "failed": failed,
        "users_considered": len(users),
        "report_date": report_date.isoformat(),
        "details": details,
    }


@celery.task(name="flask_app.tasks.notifications.send_workspace_digest_notifications")
def send_workspace_digest_notifications(report_date_iso=None):
    """Send workspace notifications:

    1) One daily due-today summary per user.
    2) One reminder per todo, 15 minutes before todo time.
    """

    report_date = date.today()
    if report_date_iso:
        try:
            report_date = date.fromisoformat(report_date_iso)
        except ValueError:
            pass

    users = UserDetail.query.all()
    sent = 0
    daily_sent = 0
    reminder_sent = 0

    now = datetime.now()
    send_daily_summary_now = now.time() >= time_of_day(hour=8, minute=0)

    for user in users:
        if not user.email:
            continue
        if user.workspace_reminders_enabled is False:
            continue

        # One due-today workspace summary per user/day.
        daily_key = _cache_key_daily_workspace(user, report_date)
        if send_daily_summary_now and not _cache_sent(daily_key):
            due_today_todos = Todo.query.filter_by(
                username=user.username,
                date=report_date,
                completed=False,
            ).all()

            if due_today_todos:
                subject, body = _build_workspace_digest_text(user, report_date)
                ok, _ = send_email(subject, [user.email], body)
                if ok:
                    _cache_mark_sent(daily_key)
                    sent += 1
                    daily_sent += 1

        # Todo reminders: send once when current minute matches (todo_time - 15 mins).
        due_timed_todos = Todo.query.filter_by(
            username=user.username,
            date=report_date,
            completed=False,
        ).all()

        for todo in due_timed_todos:
            todo_time = _todo_clock_value(todo.time)
            if not todo_time:
                continue

            reminder_at = datetime.combine(report_date, todo_time) - timedelta(minutes=15)
            if not (reminder_at <= now < reminder_at + timedelta(minutes=1)):
                continue

            reminder_key = _cache_key_todo_reminder(todo.todo_id, report_date)
            if _cache_sent(reminder_key):
                continue

            subject, body = _build_workspace_todo_reminder_text(user, todo, report_date)
            ok, _ = send_email(subject, [user.email], body)
            if ok:
                _cache_mark_sent(reminder_key)
                sent += 1
                reminder_sent += 1

    return {
        "sent": sent,
        "daily_sent": daily_sent,
        "reminder_sent": reminder_sent,
        "users_considered": len(users),
        "report_date": report_date.isoformat(),
    }
