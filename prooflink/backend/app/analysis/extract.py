"""Step 1-2 of the pipeline: normalise text, then pull out URLs, emails, phones, brands."""
import re
import unicodedata

import tldextract

from app.analysis.brands import BRANDS, Brand

# Offline: use the bundled public-suffix snapshot, never hit the network.
tld = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)

_INVISIBLE = re.compile("[\u200b-\u200f\u2060\ufeff]")
_TRAIL = ".,;:!?)]}>'\"»”’"

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
SCHEME_URL_RE = re.compile(r"""(?:(?:https?|ftp)://|www\.)[^\s<>"'`]+""")
BARE_URL_RE = re.compile(
    r"""(?<![@\w.\-/])(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(?::\d+)?(?:/[^\s<>"'`]*)?"""
)
PHONE_RE = re.compile(r"(?<![\w/])(?:\+|00)?\d[\d\s().\-]{7,17}\d(?!\w)")
ISO_DATE_RE = re.compile(r"^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = _INVISIBLE.sub("", text)
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_emails(text: str) -> list[str]:
    seen: dict[str, None] = {}
    for m in EMAIL_RE.finditer(text):
        seen[m.group(0).rstrip(_TRAIL).lower()] = None
    return list(seen)


def _urls_with(pattern: re.Pattern[str], text: str) -> list[str]:
    found: dict[str, None] = {}
    for m in pattern.finditer(text):
        raw = m.group(0).rstrip(_TRAIL)
        if not raw:
            continue
        has_scheme = bool(re.match(r"(?i)(?:https?|ftp)://|www\.", raw))
        if not has_scheme:
            # Bare domains: people type them in lowercase. "Hello.Click" is a missing space.
            if raw != raw.lower() and "/" not in raw:
                continue
        host = _host_of(raw)
        ext = tld(host)
        if not _is_ip(host) and not ext.suffix:
            continue  # "file.txt", "readme.md": not a real domain
        found[raw] = None
    return list(found)


def extract_all(text: str) -> tuple[list[str], list[str], list[str]]:
    """Return (urls, emails, phones). Links with a scheme can contain '@', so they are
    taken first and masked before emails, bare domains and phone numbers are read."""
    urls = _urls_with(SCHEME_URL_RE, text)
    rest = mask(text, urls)
    emails = extract_emails(rest)
    rest = mask(rest, emails)
    bare = _urls_with(BARE_URL_RE, rest)
    rest = mask(rest, bare)
    phones = extract_phones(rest)
    return urls + bare, emails, phones


def _host_of(raw: str) -> str:
    s = re.sub(r"(?i)^(?:https?|ftp)://", "", raw)
    s = s.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    s = s.rsplit("@", 1)[-1]  # drop userinfo
    return s.split(":", 1)[0].lower()


def _is_ip(host: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", host))


def extract_phones(text: str) -> list[str]:
    """Phone-like numbers. URLs and emails must be masked out first."""
    found: dict[str, None] = {}
    for m in PHONE_RE.finditer(text):
        raw = m.group(0).strip()
        if ISO_DATE_RE.match(raw.replace(" ", "")):
            continue
        digits = re.sub(r"\D", "", raw)
        if not 9 <= len(digits) <= 15:
            continue
        has_marker = raw.startswith(("+", "0")) or re.search(r"[\s().\-]", raw)
        if len(digits) < 10 and not has_marker:
            continue
        found[("+" if raw.startswith("+") else "") + digits] = None
    return list(found)


def mask(text: str, values: list[str]) -> str:
    for v in sorted(values, key=len, reverse=True):
        text = text.replace(v, " " * len(v))
    return text


def _brand_pattern(brand: Brand) -> re.Pattern[str]:
    names = [brand.name, *brand.aliases]
    if brand.strict_case:
        forms = []
        for n in names:
            forms += [re.escape(n), re.escape(n.upper())]
        return re.compile(r"\b(?:" + "|".join(forms) + r")\b")
    return re.compile(r"\b(?:" + "|".join(re.escape(n) for n in names) + r")\b", re.I)


_BRAND_PATTERNS = [(b, _brand_pattern(b)) for b in BRANDS]


def find_brands(text: str) -> list[Brand]:
    return [b for b, pat in _BRAND_PATTERNS if pat.search(text)]
