"""In-app notification center routes."""

from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from flask_app.models.models import Notification, db

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/api/notifications", methods=["GET"])
@jwt_required()
def list_notifications():
    current_username = get_jwt_identity()
    try:
        limit = int(request.args.get("limit", 20))
    except (TypeError, ValueError):
        limit = 20

    limit = max(1, min(limit, 100))

    notifications = Notification.query.filter_by(
        username=current_username,
        is_dismissed=False,
    ).order_by(Notification.created_at.desc()).limit(limit).all()

    unread_count = Notification.query.filter_by(
        username=current_username,
        is_dismissed=False,
        is_read=False,
    ).count()

    return jsonify({
        "success": True,
        "notifications": [n.to_dict() for n in notifications],
        "unread_count": unread_count,
    }), 200


@notifications_bp.route("/api/notifications/<int:notification_id>/read", methods=["PATCH"])
@jwt_required()
def mark_notification_read(notification_id):
    current_username = get_jwt_identity()

    notification = Notification.query.filter_by(
        notification_id=notification_id,
        username=current_username,
        is_dismissed=False,
    ).first()

    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"success": True, "notification": notification.to_dict()}), 200


@notifications_bp.route("/api/notifications/<int:notification_id>/dismiss", methods=["PATCH"])
@jwt_required()
def dismiss_notification(notification_id):
    current_username = get_jwt_identity()

    notification = Notification.query.filter_by(
        notification_id=notification_id,
        username=current_username,
        is_dismissed=False,
    ).first()

    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    notification.is_dismissed = True
    notification.dismissed_at = datetime.utcnow()
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()

    db.session.commit()
    return jsonify({"success": True}), 200


@notifications_bp.route("/api/notifications/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_notifications_read():
    current_username = get_jwt_identity()

    now = datetime.utcnow()
    rows = Notification.query.filter_by(
        username=current_username,
        is_dismissed=False,
        is_read=False,
    ).update(
        {
            Notification.is_read: True,
            Notification.read_at: now,
        },
        synchronize_session=False,
    )

    db.session.commit()
    return jsonify({"success": True, "updated": rows}), 200


@notifications_bp.route("/api/notifications/dismiss-all", methods=["PATCH"])
@jwt_required()
def dismiss_all_notifications():
    current_username = get_jwt_identity()

    now = datetime.utcnow()
    rows = Notification.query.filter_by(
        username=current_username,
        is_dismissed=False,
    ).update(
        {
            Notification.is_dismissed: True,
            Notification.dismissed_at: now,
            Notification.is_read: True,
            Notification.read_at: now,
        },
        synchronize_session=False,
    )

    db.session.commit()
    return jsonify({"success": True, "updated": rows}), 200
