"""
Celery application setup for VyaparAI.
Keeps task execution isolated and easy to scale with dedicated workers.
"""

import os

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

celery = Celery("vyaparai")

# Load backend .env so Celery CLI commands (`python -m celery -A ...`) pick up broker settings.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(project_root, ".env"))

# Safe defaults when Flask app context is not used (e.g. direct Celery CLI calls).
celery.conf.update(
    broker_url=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6380/0"),
    result_backend=os.environ.get("CELERY_RESULT_BACKEND", os.environ.get("CELERY_BROKER_URL", "redis://localhost:6380/0")),
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone=os.environ.get("CELERY_TIMEZONE", "Asia/Kolkata"),
    enable_utc=False,
)


def init_celery(app):
    """Bind Celery to Flask app context and configure schedules."""

    celery.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone=app.config["CELERY_TIMEZONE"],
        enable_utc=False,
        task_track_started=app.config["CELERY_TASK_TRACK_STARTED"],
        task_time_limit=app.config["CELERY_TASK_TIME_LIMIT"],
        task_always_eager=app.config["CELERY_TASK_ALWAYS_EAGER"],
        beat_schedule={
            "workspace-digest-scheduler-half-hourly": {
                "task": "flask_app.tasks.notifications.send_daily_business_report_notifications",
                "schedule": crontab(minute="0,30"),
            },
            "workspace-notification-check-periodic": {
                "task": "flask_app.tasks.notifications.send_workspace_digest_notifications",
                "schedule": crontab(minute="*"),
            },
            "low-stock-notification-daily": {
                "task": "flask_app.tasks.low_stock_notifications.send_low_stock_notifications",
                "schedule": crontab(hour=10, minute=0),
            },
            "credit-due-notification-daily": {
                "task": "flask_app.tasks.credit_notifications.send_credit_due_notifications",
                "schedule": crontab(hour=11, minute=0),
            },
        },
    )

    class FlaskTask(celery.Task):
        """Ensure every task runs inside Flask app context."""

        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = FlaskTask
    celery.autodiscover_tasks(["flask_app.tasks"])

    os.makedirs(app.config["EXPORTS_DIR"], exist_ok=True)

    return celery
