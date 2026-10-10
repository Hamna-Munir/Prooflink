"""Create a demo account with a few saved investigations, for showing ProofLink without typing anything live.

    python -m app.seed_demo                       # demo@prooflink.app, password printed once
    python -m app.seed_demo --email you@x.com --password "Str0ng!Pass#9"

Uses the built-in rules only (no AI call), so it is free and works offline. Safe to run twice: it
reuses the account and skips it if it already has investigations.
"""
import argparse
import secrets

from sqlalchemy import func, select

from app.analysis import analyze
from app.analysis.samples import DEMO_EXAMPLES
from app.database import SessionLocal
from app.models import AnalysisResult, Investigation, User
from app.models import Entity as EntityRow
from app.security import hash_password

EXTRA_SAMPLES = [
    "https://www.google.com",
    "Dear customer, your parcel is held at customs. Pay the Rs. 150 release fee today: http://tcs-track-pk.top/pay",
]


def seed(email: str, password: str) -> tuple[str, bool]:
    """Returns (message, created_new_data)."""
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if user is None:
            user = User(email=email.lower(), full_name="Demo User", password_hash=hash_password(password))
            db.add(user)
            db.commit()
            db.refresh(user)
        existing = db.scalar(select(func.count()).select_from(Investigation).where(Investigation.user_id == user.id)) or 0
        if existing:
            return f"{email} already has {existing} investigations. Nothing added.", False

        for text in [ex["text"] for ex in DEMO_EXAMPLES] + EXTRA_SAMPLES:
            a = analyze(text)
            inv = Investigation(user_id=user.id, input_type=a.input_type, raw_text=text, risk_level=a.risk_level, risk_score=a.risk_score)
            inv.result = AnalysisResult(
                risk_level=a.risk_level, risk_score=a.risk_score, confidence=a.confidence,
                signals=[s.model_dump() for s in a.signals], explanation=a.explanation,
                recommended_actions=a.recommended_actions, raw_analysis=a.model_dump(),
            )
            inv.entities = [EntityRow(kind=e.kind, value=e.value[:1024], flagged=e.flagged, flag_reason=e.flag_reason) for e in a.entities]
            db.add(inv)
        db.commit()
        return f"Added {len(DEMO_EXAMPLES) + len(EXTRA_SAMPLES)} sample investigations to {email}.", True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", default="demo@prooflink.app")
    parser.add_argument("--password", default=None, help="Default: a random strong password, printed once")
    args = parser.parse_args()

    password = args.password or (secrets.token_urlsafe(9) + "aA1!")
    message, created = seed(args.email, password)
    print(message)
    if created and not args.password:
        print(f"Log in with:  {args.email}  /  {password}   (only shown now; only works if the account was new)")


if __name__ == "__main__":
    main()
