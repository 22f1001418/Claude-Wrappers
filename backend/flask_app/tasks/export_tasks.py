"""Data export Celery tasks."""

import json
import os
from datetime import datetime, timedelta

from flask import current_app

from flask_app.celery_app import celery
from flask_app.models.models import Inventory, Note, Product, Sale, Todo, UserDetail
from flask_app.utils.notification_utils import create_notification
from flask_app.utils.email_utils import send_email
from sqlalchemy.orm import defer


EXPORT_DURATION_LABELS = {
    "1m": "Past 1 month",
    "3m": "Past 3 months",
    "6m": "Past 6 months",
    "12m": "Past 12 months",
    "all": "All time",
}

EXPORT_DURATION_DAYS = {
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "12m": 365,
}


def _serialize_record(record):
    data = {}
    for key, value in record.__dict__.items():
        if key.startswith("_"):
            continue
        if hasattr(value, "isoformat"):
            data[key] = value.isoformat()
        else:
            data[key] = value
    return data


@celery.task(name="flask_app.tasks.export_tasks.export_user_data_task", bind=True)
def export_user_data_task(self, username, duration="all"):
    """Build a user-level data export and notify the user by email when complete."""

    duration = str(duration or "all").strip().lower()
    if duration not in EXPORT_DURATION_LABELS:
        duration = "all"

    user = UserDetail.query.options(defer(UserDetail.password)).filter_by(username=username).first()
    if not user:
        raise ValueError(f"User not found: {username}")

    cutoff_date = None
    cutoff_datetime = None
    duration_days = EXPORT_DURATION_DAYS.get(duration)
    if duration_days is not None:
        cutoff_date = (datetime.utcnow() - timedelta(days=duration_days)).date()
        cutoff_datetime = datetime.combine(cutoff_date, datetime.min.time())
    
    inventory = Inventory.query.filter_by(username=username).first()
    inventory_id = inventory.inventory_id if inventory else None

    products = []
    if inventory_id:
        products = Product.query.filter_by(inventory_id=inventory_id).all()

    sales_query = Sale.query.filter_by(owner_username=username)
    if cutoff_date is not None:
        sales_query = sales_query.filter(Sale.date_of_purchase >= cutoff_date)
    sales = sales_query.all()

    todos_query = Todo.query.filter_by(username=username)
    if cutoff_date is not None:
        todos_query = todos_query.filter(Todo.date >= cutoff_date)
    todos = todos_query.all()

    notes_query = Note.query.filter_by(username=username)
    if cutoff_datetime is not None:
        notes_query = notes_query.filter(Note.created_at >= cutoff_datetime)
    notes = notes_query.all()

    duration_label = EXPORT_DURATION_LABELS.get(duration, "All time")

    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "username": username,
        "duration": duration,
        "duration_label": duration_label,
        "from_date": cutoff_date.isoformat() if cutoff_date else None,
        "user": _serialize_record(user),
        "inventory": _serialize_record(inventory) if inventory else None,
        "products": [_serialize_record(item) for item in products],
        "sales": [_serialize_record(item) for item in sales],
        "todos": [_serialize_record(item) for item in todos],
        "notes": [_serialize_record(item) for item in notes],
    }

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{username}_export_{duration}_{timestamp}.json"
    exports_dir = os.path.abspath(current_app.config["EXPORTS_DIR"])
    os.makedirs(exports_dir, exist_ok=True)
    export_path = os.path.abspath(os.path.join(exports_dir, filename))

    with open(export_path, "w", encoding="utf-8") as export_file:
        json.dump(payload, export_file, indent=2)

    email_sent = False
    email_error = None
    if user.email:
        subject = "VyaparAI data export completed"
        duration_details = (
            f"Range: {duration_label}"
            if not payload["from_date"]
            else f"Range: {duration_label} (from {payload['from_date']})"
        )
        body = (
            f"Hello {user.full_name or user.username},\n\n"
            f"Your data export is ready.\n"
            f"{duration_details}\n"
            f"Generated at: {payload['generated_at']}\n"
            f"Stored file: {export_path}\n\n"
            "You can request a new export anytime from Settings."
        )
        email_sent, email_error = send_email(subject, [user.email], body)

    create_notification(
        username,
        event_type="data_export_completed",
        title="Data export completed",
        message=f"Your {duration_label.lower()} export is ready.",
        payload={
            "duration": duration,
            "duration_label": duration_label,
            "export_path": export_path,
        },
    )

    return {
        "status": "completed",
        "username": username,
        "duration": duration,
        "duration_label": duration_label,
        "from_date": payload["from_date"],
        "generated_at": payload["generated_at"],
        "export_path": export_path,
        "email_sent": email_sent,
        "email_error": email_error,
    }
