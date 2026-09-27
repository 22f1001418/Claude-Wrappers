"""Celery worker entrypoint."""

from flask_app import create_app
from flask_app.celery_app import celery

app, _ = create_app()
app.app_context().push()

if __name__ == "__main__":
    celery.start(argv=["worker", "--loglevel=info", "-P", "solo"])
