"""Per-user abuse and cost protection for the endpoints that can trigger an AI call.

Per-minute limit: in memory (fine for one server process; use Redis if you scale to several).
Daily limit: counted from saved investigations, so it survives restarts.
"""
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Investigation, User

_hits: dict[int, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def reset() -> None:
    with _lock:
        _hits.clear()


def enforce(user_id: int, db: Session) -> None:
    s = get_settings()
    now = time.monotonic()
    with _lock:
        q = _hits[user_id]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= s.rate_limit_per_minute:
            wait = max(1, int(60 - (now - q[0])) + 1)
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Too many checks in a short time. Please wait {wait} seconds and try again.",
                headers={"Retry-After": str(wait)},
            )
        q.append(now)

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    used = db.scalar(
        select(func.count()).select_from(Investigation).where(Investigation.user_id == user_id, Investigation.created_at >= since)
    ) or 0
    if used >= s.daily_check_limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"You've reached today's limit of {s.daily_check_limit} checks. Please try again tomorrow.",
        )


def rate_limited_user(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    enforce(user.id, db)
    return user
