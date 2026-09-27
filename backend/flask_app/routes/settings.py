"""Settings routes for async account utilities."""

from celery.result import AsyncResult
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from flask_app.celery_app import celery
from flask_app.models.models import UserDetail, db
from flask_app.tasks.export_tasks import export_user_data_task

settings_bp = Blueprint("settings", __name__)

ALLOWED_REPORT_TIMES = {
    "same_day": {f"{hour:02d}:{minute:02d}" for hour in range(18, 23) for minute in (0, 30)} | {"23:00"},
    "next_day": {f"{hour:02d}:{minute:02d}" for hour in range(6, 11) for minute in (0, 30)},
}

ALLOWED_REPORT_TIMES_RESPONSE = {
    mode: sorted(list(times))
    for mode, times in ALLOWED_REPORT_TIMES.items()
}

ALLOWED_EXPORT_DURATIONS = {"1m", "3m", "6m", "12m", "all"}
MIN_LOW_STOCK_THRESHOLD = 1
MAX_LOW_STOCK_THRESHOLD = 200


def _normalize_notification_preferences(user, payload):
    day_mode = payload.get("daily_report_day_mode", user.daily_report_day_mode or "same_day")
    report_time = payload.get("daily_report_time", user.daily_report_time or "20:30")

    if day_mode not in ALLOWED_REPORT_TIMES:
        raise ValueError("daily_report_day_mode must be one of: same_day, next_day")

    if report_time not in ALLOWED_REPORT_TIMES[day_mode]:
        allowed = ", ".join(sorted(ALLOWED_REPORT_TIMES[day_mode]))
        raise ValueError(f"daily_report_time is invalid for {day_mode}. Allowed times: {allowed}")

    return day_mode, report_time


def _normalize_low_stock_threshold(user, payload):
    threshold = payload.get("low_stock_threshold", user.low_stock_threshold)
    try:
        threshold = int(threshold)
    except (TypeError, ValueError):
        raise ValueError("low_stock_threshold must be an integer")

    if threshold < MIN_LOW_STOCK_THRESHOLD or threshold > MAX_LOW_STOCK_THRESHOLD:
        raise ValueError(
            f"low_stock_threshold must be between {MIN_LOW_STOCK_THRESHOLD} and {MAX_LOW_STOCK_THRESHOLD}"
        )

    return threshold


@settings_bp.route("/api/settings/export-data", methods=["POST"])
@jwt_required()
def export_data():
    """Queue a user data export job and return task metadata."""

    current_username = get_jwt_identity()
    payload = request.get_json(silent=True) or {}
    duration = str(payload.get("duration", "all")).strip().lower()
    if duration not in ALLOWED_EXPORT_DURATIONS:
        return jsonify({
            "error": "Invalid export duration. Allowed values: 1m, 3m, 6m, 12m, all",
        }), 400

    task = export_user_data_task.delay(current_username, duration)

    response = {
        "success": True,
        "message": "Data export job queued",
        "duration": duration,
        "task_id": task.id,
        "status": task.status,
    }

    if task.ready():
        try:
            response["result"] = task.get(timeout=1)
        except Exception as exc:
            response["result_error"] = str(exc)

    return jsonify(response), 202


@settings_bp.route("/api/settings/export-data/<task_id>", methods=["GET"])
@jwt_required()
def export_data_status(task_id):
    """Fetch status/result for a previously queued export job."""

    task_result = AsyncResult(task_id, app=celery)

    payload = {
        "task_id": task_id,
        "status": task_result.status,
        "ready": task_result.ready(),
        "successful": task_result.successful() if task_result.ready() else False,
    }

    if task_result.ready():
        if task_result.successful():
            payload["result"] = task_result.result
        else:
            payload["error"] = str(task_result.result)

    return jsonify(payload), 200


@settings_bp.route("/api/settings/notifications", methods=["GET"])
@jwt_required()
def get_notification_settings():
    """Get per-user notification preferences."""

    current_username = get_jwt_identity()
    user = UserDetail.query.filter_by(username=current_username).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.role not in ["owner", "user"]:
        return jsonify({"error": "Notification settings are available for shop owners only"}), 403

    return jsonify({
        "success": True,
        "daily_report_enabled": bool(user.daily_report_enabled),
        "daily_report_day_mode": user.daily_report_day_mode or "same_day",
        "daily_report_time": user.daily_report_time or "20:30",
        "workspace_reminders_enabled": bool(user.workspace_reminders_enabled),
        "credit_reminders_enabled": bool(user.credit_reminders_enabled),
        "low_stock_threshold": int(user.low_stock_threshold or 10),
        "low_stock_threshold_limits": {
            "min": MIN_LOW_STOCK_THRESHOLD,
            "max": MAX_LOW_STOCK_THRESHOLD,
        },
        "allowed_report_times": ALLOWED_REPORT_TIMES_RESPONSE,
    }), 200


@settings_bp.route("/api/settings/notifications", methods=["PUT"])
@jwt_required()
def update_notification_settings():
    """Update per-user notification preferences."""

    current_username = get_jwt_identity()
    user = UserDetail.query.filter_by(username=current_username).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.role not in ["owner", "user"]:
        return jsonify({"error": "Notification settings are available for shop owners only"}), 403

    data = request.get_json() or {}
    if "daily_report_enabled" in data:
        user.daily_report_enabled = bool(data["daily_report_enabled"])
    if "workspace_reminders_enabled" in data:
        user.workspace_reminders_enabled = bool(data["workspace_reminders_enabled"])
    if "credit_reminders_enabled" in data:
        user.credit_reminders_enabled = bool(data["credit_reminders_enabled"])

    try:
        day_mode, report_time = _normalize_notification_preferences(user, data)
        low_stock_threshold = _normalize_low_stock_threshold(user, data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    user.daily_report_day_mode = day_mode
    user.daily_report_time = report_time
    user.low_stock_threshold = low_stock_threshold
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Notification preferences updated",
        "daily_report_enabled": bool(user.daily_report_enabled),
        "daily_report_day_mode": user.daily_report_day_mode,
        "daily_report_time": user.daily_report_time,
        "workspace_reminders_enabled": bool(user.workspace_reminders_enabled),
        "credit_reminders_enabled": bool(user.credit_reminders_enabled),
        "low_stock_threshold": int(user.low_stock_threshold or 10),
    }), 200
