from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.password_policy import password_error
from app.schemas import (
    ChangePasswordRequest, DeleteAccountRequest, LoginRequest, SignupRequest, UpdateProfileRequest, UserOut,
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=create_access_token(user_id),
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        path="/",
    )


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        email=email,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    # Same message for unknown email and wrong password: don't reveal which accounts exist
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(settings.cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_profile(body: UpdateProfileRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.full_name = body.full_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is not correct")
    if body.new_password == body.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a password you haven't used here before")
    problem = password_error(body.new_password, user.email, user.full_name)
    if problem:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, problem)
    user.password_hash = hash_password(body.new_password)
    db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(body: DeleteAccountRequest, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permanently deletes the account and everything saved under it (investigations, entities, results)."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your password is not correct")
    db.delete(user)  # cascades to investigations -> entities / analysis_results
    db.commit()
    response.delete_cookie(settings.cookie_name, path="/")
