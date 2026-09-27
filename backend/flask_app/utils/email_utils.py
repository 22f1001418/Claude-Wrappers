"""SMTP helper utilities for background notifications."""

import smtplib
from email.message import EmailMessage

from flask import current_app


def _clean(value):
    if isinstance(value, str):
        return value.strip()
    return value


def send_email(subject, recipients, body, html_body=None):
    """Send an email using SMTP settings from Flask config.

    Args:
        subject: Email subject.
        recipients: List of recipient email addresses.
        body: Plain-text fallback body.
        html_body: Optional HTML content for rich emails.
    """

    if not recipients:
        return False, "No recipients provided"

    if not current_app.config.get("MAIL_ENABLED", False):
        current_app.logger.warning("MAIL_ENABLED is false. Skipping email send.")
        return False, "Mail delivery is disabled"

    host = _clean(current_app.config.get("MAIL_HOST"))
    port = int(current_app.config.get("MAIL_PORT", 587))
    username = _clean(current_app.config.get("MAIL_USERNAME"))
    password = _clean(current_app.config.get("MAIL_PASSWORD"))
    sender = _clean(current_app.config.get("MAIL_FROM"))
    use_tls = bool(current_app.config.get("MAIL_USE_TLS", True))
    use_ssl = bool(current_app.config.get("MAIL_USE_SSL", False))

    if not host or not sender:
        return False, "MAIL_HOST or MAIL_FROM is not configured"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(_clean(r) for r in recipients if _clean(r))
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=20) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                if use_tls:
                    server.starttls()
                if username and password:
                    server.login(username, password)
                server.send_message(msg)

        return True, None
    except Exception as exc:
        current_app.logger.exception("Email send failed: %s", exc)
        return False, str(exc)
