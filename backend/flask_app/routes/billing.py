from flask import Blueprint, jsonify, request
from datetime import datetime, date
from sqlalchemy import func
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_app.models.models import db, Bill, Sale, Product, UserDetail, Cashier
from flask_app.tasks.credit_notifications import send_credit_due_notifications_for_owner
from flask_app.tasks.low_stock_notifications import send_low_stock_notifications_for_owner
from flask_app.utils.cache_utils import bump_owner_cache_version
import os

import razorpay

billing_bp = Blueprint("billing", __name__, url_prefix="/api/billing")


def _get_effective_owner_username(username):
    """Resolve owner namespace for users that operate on behalf of a store owner."""

    user = UserDetail.query.filter_by(username=username).first()
    if not user:
        return username

    if user.role == 'cashier':
        relationship = Cashier.query.filter_by(cashier_username=username).first()
        if relationship and relationship.added_by_owner:
            return relationship.added_by_owner

    return username


def _get_razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    if not key_id or not key_secret:
        return None, None, None

    client = razorpay.Client(auth=(key_id, key_secret))
    return client, key_id, key_secret


@billing_bp.route("/razorpay/create-order", methods=["POST"])
def create_razorpay_order():
    client, key_id, _ = _get_razorpay_client()
    if client is None:
        return jsonify({"success": False, "message": "Razorpay keys are not configured"}), 500

    data = request.get_json() or {}

    try:
        amount = int(data.get("amount", 0))
    except Exception:
        return jsonify({"success": False, "message": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"success": False, "message": "Amount should be greater than 0"}), 400

    try:
        order = client.order.create({
            "amount": amount * 100,
            "currency": "INR",
            "payment_capture": 1,
        })
    except Exception as err:
        return jsonify({"success": False, "message": f"Failed to create Razorpay order: {err}"}), 500

    return jsonify({
        "success": True,
        "data": {
            "order_id": order.get("id"),
            "amount": amount,
            "currency": "INR",
            "key_id": key_id,
        },
    })


@billing_bp.route("/razorpay/verify", methods=["POST"])
def verify_razorpay_payment():
    client, _, _ = _get_razorpay_client()
    if client is None:
        return jsonify({"success": False, "message": "Razorpay keys are not configured"}), 500

    data = request.get_json() or {}

    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return jsonify({"success": False, "message": "Missing Razorpay verification data"}), 400

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
    except Exception:
        return jsonify({"success": False, "message": "Razorpay payment verification failed"}), 400

    return jsonify({"success": True, "message": "Payment verified"})

@billing_bp.route("/products", methods=["GET"])
@jwt_required()
def get_products():
    query = request.args.get("q", "")

    products = Product.query.filter(
        Product.product_name.ilike(f"%{query}%")
    ).limit(10).all()

    return jsonify({
        "success": True,
        "data": [p.to_dict() for p in products]
    })


@billing_bp.route("/check-customer", methods=["GET"])
@jwt_required()
def check_customer():
    current_username = get_jwt_identity()
    owner_username = _get_effective_owner_username(current_username)
    name = request.args.get("name")

    if not name:
        return jsonify({"success": False, "message": "Customer name required"}), 400

    sale = (
        Sale.query
        .filter(
            Sale.owner_username == owner_username,
            Sale.customer_name.ilike(f"%{name}%"),
            Sale.amount_remaining > 0
        )
        .order_by(Sale.sale_id.desc())
        .first()
    )

    if not sale:
        return jsonify({"success": True, "sale": None})

    return jsonify({
        "success": True,
        "sale": sale.to_dict()
    })


@billing_bp.route("/create", methods=["POST"])
@jwt_required()
def create_bill():
    current_username = get_jwt_identity()
    owner_username = _get_effective_owner_username(current_username)

    data = request.get_json() or {}

    try:
        customer_name = str(data.get("customer_name", "")).strip()
        customer_phone = data.get("customer_phone")
        items = data.get("items", [])
        total_cost = int(data.get("total_cost", 0))
        amount_paid = int(data.get("amount_paid", 0))
        payment_method = str(data.get("payment_method", "cash")).strip().lower()
        due_date = data.get("due_date")
        previous_sale_id = data.get("previous_sale_id")

        # FORCE INTEGER CONVERSION
        if previous_sale_id:
            try:
                previous_sale_id = int(previous_sale_id)
            except:
                previous_sale_id = None

    except Exception:
        return jsonify({"success": False, "message": "Invalid input data"}), 400

    if not isinstance(items, list) or not items:
        return jsonify({"success": False, "message": "Bill is empty. Add at least one item before creating bill."}), 400

    valid_items = []
    for item in items:
        product_name = str(item.get("product_name", "")).strip()
        units = int(item.get("units", 0) or 0)

        if product_name and units > 0:
            valid_items.append(item)

    if not valid_items:
        return jsonify({"success": False, "message": "Bill is empty. Add at least one item before creating bill."}), 400

    if payment_method == "credit" and not customer_name:
        return jsonify({"success": False, "message": "Customer name is required for credit billing."}), 400

    if payment_method == "credit" and not due_date:
        return jsonify({"success": False, "message": "Due Date is required for credit billing."}), 400

    if payment_method in ["cash", "upi"]:
        amount_paid = total_cost

    if not customer_name:
        customer_name = "Walk-in Customer"

    max_bill_id = db.session.query(func.max(Bill.bill_id)).scalar()
    new_bill_id = (max_bill_id or 0) + 1

    changed_product_ids = []
    for item in valid_items:
        new_item = Bill(
            bill_id=new_bill_id,
            product_name=item.get("product_name"),
            units=int(item.get("units", 1)),
            unit_price=int(item.get("unit_price", 0)),
            product_id=item.get("product_id")
        )
        db.session.add(new_item)

        product_id = item.get("product_id")
        if product_id:
            product = Product.query.get(product_id)
            if not product:
                db.session.rollback()
                return jsonify({"success": False, "message": f"Product not found for ID {product_id}"}), 404

            units = int(item.get("units", 1))
            if units > product.stock:
                db.session.rollback()
                return jsonify({
                    "success": False,
                    "message": f"Insufficient stock for {product.product_name}. Available: {product.stock}, requested: {units}",
                }), 400

            product.stock -= units
            changed_product_ids.append(product.product_id)

    sale = Sale(
        bill_id=new_bill_id,
        owner_username=owner_username,
        customer_name=customer_name,
        customer_phone=customer_phone,
        total_cost=total_cost,
        amount_paid=amount_paid,
        payment_method=payment_method,
        date_of_purchase=date.today()
    )

    if amount_paid < total_cost and due_date:
        try:
            sale.due_date = datetime.strptime(due_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({
                "success": False,
                "message": "Invalid due date format (YYYY-MM-DD required)"
            }), 400

    sale.update_payment_fields()

    db.session.add(sale)

    #  UPDATE OLD SALE IF USER IS CLEARING PREVIOUS DUE
    if previous_sale_id is not None:
       print("Previous Sale ID received:", previous_sale_id)

    old_sale = Sale.query.get(previous_sale_id)

    if old_sale and old_sale.owner_username == owner_username:
        print("Old sale found. Closing it.")

        old_sale.amount_paid = old_sale.total_cost
        old_sale.amount_remaining = 0
        old_sale.credit = False
        old_sale.due_date = None

    else:
        print("Old sale NOT found in DB")

    db.session.commit()
    bump_owner_cache_version(owner_username)

    if changed_product_ids:
        send_low_stock_notifications_for_owner.delay(owner_username)

    if sale.amount_remaining > 0 and sale.due_date is not None:
        send_credit_due_notifications_for_owner.delay(owner_username)

    return jsonify({
        "success": True,
        "message": "Bill created successfully",
        "data": sale.to_dict()
    })