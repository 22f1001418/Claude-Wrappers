"""Helpers for Redis-backed response caching and invalidation."""

from flask import request
from flask_jwt_extended import get_jwt_identity

from flask_app.extensions import cache


def _cache_version_key(scope):
    return f"cache:version:{scope}"


def _get_cache_version(scope):
    key = _cache_version_key(scope)
    value = cache.get(key)
    if value is None:
        cache.set(key, 1, timeout=0)
        return 1

    try:
        return int(value)
    except (TypeError, ValueError):
        cache.set(key, 1, timeout=0)
        return 1


def _bump_cache_version(scope):
    key = _cache_version_key(scope)
    try:
        cache.inc(key)
    except Exception:
        value = cache.get(key)
        try:
            next_value = int(value) + 1
        except (TypeError, ValueError):
            next_value = 2
        cache.set(key, next_value, timeout=0)


def _query_fingerprint():
    if not request.args:
        return ""

    parts = []
    for key in sorted(request.args.keys()):
        values = request.args.getlist(key)
        for value in sorted(values):
            parts.append(f"{key}={value}")

    return "&".join(parts)


def owner_cache_key():
    """Build a cache key scoped to authenticated user and endpoint."""

    username = "anonymous"
    try:
        identity = get_jwt_identity()
        if identity:
            username = str(identity)
    except Exception:
        pass

    version = _get_cache_version(f"owner:{username}")
    query = _query_fingerprint()
    return f"resp:{request.endpoint}:{username}:v{version}:{request.path}?{query}"


def global_cache_key():
    """Build a cache key for global/admin responses."""

    version = _get_cache_version("global")
    query = _query_fingerprint()
    return f"resp:{request.endpoint}:global:v{version}:{request.path}?{query}"


def bump_owner_cache_version(username):
    """Invalidate owner-scoped and global cache namespaces."""

    if not username:
        return

    _bump_cache_version(f"owner:{username}")
    _bump_cache_version("global")
