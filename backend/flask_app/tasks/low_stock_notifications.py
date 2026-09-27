"""Low stock notification Celery tasks."""

from collections import defaultdict

from flask import current_app

from flask_app.celery_app import celery
from flask_app.models.models import Inventory, Product, UserDetail
from flask_app.utils.email_utils import send_email


def _resolve_owner_low_stock_threshold(owner):
    configured = getattr(owner, "low_stock_threshold", None)
    if configured is None:
        configured = current_app.config.get("CELERY_LOW_STOCK_THRESHOLD", 10)

    try:
        return max(1, int(configured))
    except (TypeError, ValueError):
        return 10


@celery.task(name="flask_app.tasks.low_stock_notifications.send_low_stock_notifications")
def send_low_stock_notifications():
    """Send low stock emails grouped by inventory owner."""

    owner_products = defaultdict(list)
    owner_threshold_map = {}

    inventories = Inventory.query.all()
    owners = UserDetail.query.filter(UserDetail.username.in_([inv.username for inv in inventories])).all()
    owner_map = {owner.username: owner for owner in owners}

    total_items_found = 0
    for inventory in inventories:
        owner_username = inventory.username
        owner = owner_map.get(owner_username)
        if not owner:
            continue

        threshold = _resolve_owner_low_stock_threshold(owner)
        products = Product.query.filter(
            Product.inventory_id == inventory.inventory_id,
            Product.stock <= threshold,
        ).order_by(Product.stock.asc()).all()

        if products:
            owner_products[owner_username].extend(products)
            owner_threshold_map[owner_username] = threshold
            total_items_found += len(products)

    sent = 0
    for owner_username, products in owner_products.items():
        owner = UserDetail.query.filter_by(username=owner_username).first()
        if not owner or not owner.email:
            continue

        threshold = owner_threshold_map.get(owner_username, _resolve_owner_low_stock_threshold(owner))
        lines = [
            f"- {product.product_name}: {product.stock} unit(s) remaining"
            for product in sorted(products, key=lambda p: p.stock)
        ]

        subject = "VyaparAI low stock alert"
        body = (
            f"Hello {owner.full_name or owner.username},\n\n"
            f"The following products are at or below {threshold} units:\n"
            + "\n".join(lines)
            + "\n\nPlease restock to avoid stockouts."
        )

        ok, _ = send_email(subject, [owner.email], body)
        if ok:
            sent += 1

    return {
        "sent": sent,
        "owners_notified": len(owner_products),
        "items_found": total_items_found,
    }


@celery.task(name="flask_app.tasks.low_stock_notifications.send_low_stock_notifications_for_owner")
def send_low_stock_notifications_for_owner(owner_username):
    """Send low stock email for one owner (event-triggered)."""

    if not owner_username:
        return {"sent": 0, "error": "owner_username is required"}

    owner = UserDetail.query.filter_by(username=owner_username).first()
    if not owner or not owner.email:
        return {"sent": 0, "owner": owner_username, "error": "owner not found or missing email"}

    threshold = _resolve_owner_low_stock_threshold(owner)

    inventory = Inventory.query.filter_by(username=owner_username).first()
    if not inventory:
        return {"sent": 0, "owner": owner_username, "items_found": 0}

    products = Product.query.filter(
        Product.inventory_id == inventory.inventory_id,
        Product.stock <= threshold,
    ).order_by(Product.stock.asc()).all()

    if not products:
        return {"sent": 0, "owner": owner_username, "items_found": 0}

    lines = [
        f"- {product.product_name}: {product.stock} unit(s) remaining"
        for product in products
    ]
    subject = "VyaparAI low stock alert"
    body = (
        f"Hello {owner.full_name or owner.username},\n\n"
        f"The following products are at or below {threshold} units:\n"
        + "\n".join(lines)
        + "\n\nPlease restock to avoid stockouts."
    )

    ok, err = send_email(subject, [owner.email], body)
    return {
        "sent": 1 if ok else 0,
        "owner": owner_username,
        "items_found": len(products),
        "error": err,
    }
