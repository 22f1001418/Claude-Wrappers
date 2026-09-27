from flask import Blueprint, jsonify, request
from datetime import date, timedelta, datetime
from sqlalchemy import func, extract
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_app.models.models import db, Sale, UserDetail, Cashier
from flask_app.tasks.credit_notifications import send_credit_due_notifications_for_owner
from flask_app.extensions import cache
from flask_app.utils.cache_utils import bump_owner_cache_version, owner_cache_key

credit_bp = Blueprint('credit', __name__, url_prefix='/api')


def _get_effective_owner_username(username):
    """Resolve the owner namespace for owner-scoped credit data access."""

    user = UserDetail.query.filter_by(username=username).first()
    if not user:
        return username

    if user.role == 'cashier':
        relationship = Cashier.query.filter_by(cashier_username=username).first()
        if relationship and relationship.added_by_owner:
            return relationship.added_by_owner

    return username


# ============================================================
# CREDIT DASHBOARD
# ============================================================
@credit_bp.route('/credits/dashboard', methods=['GET'])
@jwt_required()
@cache.cached(timeout=120, key_prefix=owner_cache_key)
def credit_dashboard():
    current_username = get_jwt_identity()
    owner_username = _get_effective_owner_username(current_username)
    today = date.today()

    # --------------------------
    # Total Outstanding
    # --------------------------
    total_outstanding = db.session.query(
        func.sum(Sale.amount_remaining)
    ).filter(Sale.owner_username == owner_username).scalar() or 0

    total_paid = db.session.query(
        func.sum(Sale.amount_paid)
    ).filter(Sale.owner_username == owner_username).scalar() or 0

    total_customers = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.amount_remaining > 0
    ).count()

    overdue_count = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.amount_remaining > 0,
        Sale.due_date < today
    ).count()

    # --------------------------
    # Payment Status Counts
    # --------------------------
    fully_paid = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.amount_remaining == 0
    ).count()

    partial = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.amount_remaining > 0,
        Sale.amount_paid > 0
    ).count()

    unpaid = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.amount_remaining > 0,
        Sale.amount_paid == 0
    ).count()

    # --------------------------
    # Trend for Last 6 Months
    # --------------------------
    trend = []

    for i in range(5, -1, -1):
        month_date = today - timedelta(days=i * 30)

        month_total = db.session.query(
            func.sum(Sale.amount_remaining)
        ).filter(
            Sale.owner_username == owner_username,
            extract("month", Sale.date_of_purchase) == month_date.month,
            extract("year", Sale.date_of_purchase) == month_date.year
        ).scalar() or 0

        trend.append({
            "month": month_date.strftime("%b %Y"),
            "amount": month_total
        })

    # --------------------------
    # ALL Pending Customers
    # --------------------------
    pending_sales = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.amount_remaining > 0
    ).order_by(Sale.amount_remaining.desc()).all()

    customers = []
    for s in pending_sales:
        customers.append({
            "sale_id": s.sale_id,
            "customer_name": s.customer_name,
            "customer_phone": s.customer_phone,
            "total_cost": s.total_cost,
            "amount_paid": s.amount_paid,
            "amount_remaining": s.amount_remaining,
            "credit": s.credit,
            "due_date": s.due_date.strftime("%Y-%m-%d") if s.due_date else None,
            "date_of_purchase": s.date_of_purchase.strftime("%Y-%m-%d") if s.date_of_purchase else None,
            "payment_method": s.payment_method
        })

    return jsonify({
        "success": True,
        "data": {
            "totalOutstanding": total_outstanding,
            "customerCount": total_customers,
            "overdue": overdue_count,
            "totalPaid": total_paid,
            "trend": trend,
            "fullyPaid": fully_paid,
            "partial": partial,
            "unpaid": unpaid,
            "customers": customers
        }
    })


# ============================================================
# SEARCH CUSTOMERS BY NAME
# ============================================================
@credit_bp.route('/credits/search', methods=['GET'])
@jwt_required()
@cache.cached(timeout=45, key_prefix=owner_cache_key)
def search_credit_customers():
    current_username = get_jwt_identity()
    owner_username = _get_effective_owner_username(current_username)
    query = request.args.get("q", "")

    sales = Sale.query.filter(
        Sale.owner_username == owner_username,
        Sale.customer_name.ilike(f"%{query}%"),
        Sale.amount_remaining > 0
    ).order_by(Sale.amount_remaining.desc()).all()

    return jsonify({
        "success": True,
        "data": [sale.to_dict() for sale in sales]
    })


# ============================================================
# CLEAR CREDIT (UPDATE SALE)
# ============================================================
@credit_bp.route('/credits/clear/<int:sale_id>', methods=['PUT'])
@jwt_required()
def clear_credit(sale_id):
    current_username = get_jwt_identity()
    owner_username = _get_effective_owner_username(current_username)
    data = request.get_json()

    sale = Sale.query.get_or_404(sale_id)

    if sale.owner_username != owner_username:
        return jsonify({"success": False, "message": "Unauthorized access to this credit record"}), 403

    try:
        additional_payment = float(data.get("amount_paid", 0))
    except:
        return jsonify({"success": False, "message": "Invalid amount"}), 400

    if additional_payment <= 0:
        return jsonify({"success": False, "message": "Amount must be greater than 0"}), 400

    # --------------------------
    # Update Payment
    # --------------------------
    sale.amount_paid += additional_payment
    sale.amount_remaining = sale.total_cost - sale.amount_paid

    # Get new due date from frontend
    new_due_date = data.get("new_due_date")

    # --------------------------
    # If Fully Paid
    # --------------------------
    if sale.amount_remaining <= 0:
        sale.amount_remaining = 0
        sale.credit = False
        sale.due_date = None  # Clear due date when fully paid

    # --------------------------
    # If Partial Payment
    # --------------------------
    elif new_due_date:
        try:
            sale.due_date = datetime.strptime(new_due_date, "%Y-%m-%d").date()
        except:
            return jsonify({
                "success": False,
                "message": "Invalid due date format"
            }), 400

    db.session.commit()
    bump_owner_cache_version(owner_username)

    if sale.amount_remaining > 0 and sale.due_date is not None:
        send_credit_due_notifications_for_owner.delay(owner_username)

    return jsonify({
        "success": True,
        "message": "Credit updated successfully",
        "data": sale.to_dict()
    })