"""Password rules, enforced on signup (the frontend shows the same rules live).

Login never checks strength, so existing accounts keep working.
"""
import re

MIN_LENGTH = 8

# Bases of very common passwords (compared after undoing leetspeak and stripping non-letters),
# so "Password@123" and "P@ssw0rd!" are rejected even though they tick every box.
COMMON_BASES = {
    "password", "passwort", "passw", "qwerty", "qwertyuiop", "letmein", "welcome", "iloveyou",
    "admin", "administrator", "login", "abc", "abcdef", "monkey", "dragon", "football",
    "baseball", "master", "sunshine", "princess", "shadow", "superman", "trustno", "prooflink",
    "changeme", "secret", "test", "testing", "guest", "hello", "freedom", "whatever",
}
_LEET = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s", "!": "i", "7": "t"})


def missing_requirements(password: str) -> list[str]:
    missing = []
    if len(password) < MIN_LENGTH:
        missing.append(f"at least {MIN_LENGTH} characters")
    if not re.search(r"[a-z]", password):
        missing.append("a lowercase letter")
    if not re.search(r"[A-Z]", password):
        missing.append("an uppercase letter")
    if not re.search(r"\d", password):
        missing.append("a number")
    if not re.search(r"[^A-Za-z0-9\s]", password):
        missing.append("a symbol such as ! @ # $")
    return missing


def _bases(password: str) -> set[str]:
    """Reduce 'P@ssw0rd!' or 'Password@123' to the underlying word before comparing."""
    core = re.sub(r"[^a-z]+$", "", password.lower())  # drop trailing digits/symbols
    return {re.sub(r"[^a-z]", "", core), re.sub(r"[^a-z]", "", core.translate(_LEET))}


def password_error(password: str, email: str = "", full_name: str = "") -> str | None:
    """Return a user-facing message if the password is too weak, else None."""
    missing = missing_requirements(password)
    if missing:
        return "Password is too weak. It needs " + ", ".join(missing) + "."
    if _bases(password) & COMMON_BASES:
        return "That password is too common. Choose something harder to guess."
    lowered = password.lower()
    personal = [p for p in re.split(r"[^a-z]+", full_name.lower()) if len(p) >= 4]
    local = email.split("@")[0].lower()
    if (len(local) >= 4 and local in lowered) or any(p in lowered for p in personal):
        return "Don't use your name or email address inside your password."
    return None
