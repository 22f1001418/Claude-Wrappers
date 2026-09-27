"""Helpers for creating in-app notifications."""

import json

from flask_app.models.models import Notification, db


def create_notification(username, event_type, title, message, payload=None, commit=True):
    """Create one notification for a user."""

    if not username:
        return None

    notification = Notification(
        username=username,
        event_type=event_type or "general",
        title=title,
        message=message,
        payload=json.dumps(payload) if payload is not None else None,
    )
    db.session.add(notification)

    if commit:
        db.session.commit()

    return notification


def create_notifications_for_users(usernames, event_type, title, message, payload=None, commit=True):
    """Create same notification for multiple users."""

    clean_usernames = [u for u in dict.fromkeys(usernames or []) if u]
    if not clean_usernames:
        return 0

    payload_json = json.dumps(payload) if payload is not None else None
    for username in clean_usernames:
        db.session.add(Notification(
            username=username,
            event_type=event_type or "general",
            title=title,
            message=message,
            payload=payload_json,
        ))

    if commit:
        db.session.commit()

    return len(clean_usernames)
