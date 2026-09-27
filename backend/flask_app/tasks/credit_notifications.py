"""Credit due reminder Celery tasks."""

from datetime import date, timedelta

from flask import current_app

from flask_app.celery_app import celery
from flask_app.models.models import Sale, UserDetail
from flask_app.utils.email_utils import send_email


@celery.task(name="flask_app.tasks.credit_notifications.send_credit_due_notifications")
def send_credit_due_notifications():
    """Send credit due and overdue reminders to owners."""

    reminder_days = int(current_app.config.get("CELERY_CREDIT_REMINDER_DAYS", 2))
    today = date.today()
    due_soon_cutoff = today + timedelta(days=reminder_days)

    owners = UserDetail.query.filter(UserDetail.role.in_(["owner", "admin"])).all()
    sent = 0

    for owner in owners:
        if not owner.email:
            continue
        if owner.credit_reminders_enabled is False:
            continue

        pending_sales = Sale.query.filter(
            Sale.owner_username == owner.username,
            Sale.amount_remaining > 0,
            Sale.due_date.isnot(None),
            Sale.due_date <= due_soon_cutoff,
        ).order_by(Sale.due_date.asc()).all()

        if not pending_sales:
            continue

        lines = []
        for sale in pending_sales:
            status = "OVERDUE" if sale.due_date < today else "Due soon"
            lines.append(
                f"- {sale.customer_name} | Remaining: {sale.amount_remaining} | Due: {sale.due_date.isoformat()} | {status}"
            )

        subject = "VyaparAI credit due reminder"
        body = (
            f"Hello {owner.full_name or owner.username},\n\n"
            f"Credits due within {reminder_days} day(s):\n"
            + "\n".join(lines)
            + "\n\nPlease follow up to reduce outstanding credit."
        )

        ok, _ = send_email(subject, [owner.email], body)
        if ok:
            sent += 1

    return {"sent": sent, "owners_considered": len(owners)}


@celery.task(name="flask_app.tasks.credit_notifications.send_credit_due_notifications_for_owner")
def send_credit_due_notifications_for_owner(owner_username):
    """Send credit due reminder for one owner (event-triggered)."""

    if not owner_username:
        return {"sent": 0, "error": "owner_username is required"}

    reminder_days = int(current_app.config.get("CELERY_CREDIT_REMINDER_DAYS", 2))
    today = date.today()
    due_soon_cutoff = today + timedelta(days=reminder_days)

    owner = UserDetail.query.filter_by(username=owner_username).first()
    if not owner or not owner.email:
        return {"sent": 0, "owner": owner_username, "error": "owner not found or missing email"}
    if owner.credit_reminders_enabled is False:
        return {"sent": 0, "owner": owner_username, "items_found": 0, "reason": "credit reminders disabled"}

    pending_sales = Sale.query.filter(
        Sale.owner_username == owner.username,
        Sale.amount_remaining > 0,
        Sale.due_date.isnot(None),
        Sale.due_date <= due_soon_cutoff,
    ).order_by(Sale.due_date.asc()).all()

    if not pending_sales:
        return {"sent": 0, "owner": owner_username, "items_found": 0}

    lines = []
    for sale in pending_sales:
        status = "OVERDUE" if sale.due_date < today else "Due soon"
        lines.append(
            f"- {sale.customer_name} | Remaining: {sale.amount_remaining} | Due: {sale.due_date.isoformat()} | {status}"
        )

    subject = "VyaparAI credit due reminder"
    body = (
        f"Hello {owner.full_name or owner.username},\n\n"
        f"Credits due within {reminder_days} day(s):\n"
        + "\n".join(lines)
        + "\n\nPlease follow up to reduce outstanding credit."
    )

    ok, err = send_email(subject, [owner.email], body)
    return {
        "sent": 1 if ok else 0,
        "owner": owner_username,
        "items_found": len(pending_sales),
        "error": err,
    }
