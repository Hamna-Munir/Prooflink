from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.security import decode_access_token

settings = get_settings()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Please sign in again.")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    return user
