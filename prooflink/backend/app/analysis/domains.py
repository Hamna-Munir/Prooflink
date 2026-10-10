"""Step 3: URL / domain analysis. Purely passive: we never visit the link."""
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from app.analysis.brands import BRANDS, BRANDS_BY_LABEL, Brand
from app.analysis.extract import _host_of, _is_ip, tld
from app.analysis.result import Signal

SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "shorturl.at",
    "ow.ly", "buff.ly", "tiny.cc", "rebrand.ly", "t.ly", "s.id", "bit.do", "shorte.st",
    "lnkd.in", "tr.im", "v.gd", "qr.ae", "adf.ly", "clck.ru", "urlz.fr", "soo.gd",
}
# Cheap or abused TLDs. Many are legitimate too, so this is a weak signal.
SUSPICIOUS_TLDS = {
    "xyz", "top", "tk", "ml", "ga", "cf", "gq", "icu", "buzz", "click", "loan", "work",
    "cyou", "cfd", "sbs", "rest", "zip", "mov", "monster", "cam", "country", "support",
}
RISKY_WORDS = (
    "login", "signin", "verify", "verification", "secure", "security", "account", "update",
    "confirm", "wallet", "billing", "support", "helpdesk", "unlock", "suspended", "recovery",
    "validate", "authenticate",
)
EXECUTABLE_EXT = (".apk", ".exe", ".scr", ".msi", ".bat", ".cmd", ".jar", ".dmg")

# Characters from other alphabets that look like Latin letters
CONFUSABLES = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ѕ": "s",
    "ԁ": "d", "ɡ": "g", "ӏ": "l", "ο": "o", "ν": "v", "ρ": "p", "α": "a", "ı": "i",
})
LEET = {"0": "o", "3": "e", "5": "s", "$": "s", "@": "a", "4": "a", "7": "t"}


@dataclass
class UrlInfo:
    raw: str
    display: str  # normalised for showing / storing
    host: str
    registered: str  # registered domain, e.g. paypal.com
    label: str  # the main label, e.g. paypal
    suffix: str
    subdomain: str
    path: str
    scheme: str
    is_ip: bool
    has_userinfo: bool
    is_unicode: bool


def parse_url(raw: str) -> UrlInfo:
    scheme = "https" if re.match(r"(?i)https://", raw) else "http" if re.match(r"(?i)http://", raw) else ""
    target = raw if re.match(r"(?i)(?:https?|ftp)://", raw) else "http://" + raw
    parts = urlsplit(target)
    host = _host_of(raw)
    try:
        decoded = host.encode("ascii").decode("idna")
    except (UnicodeError, UnicodeDecodeError):
        decoded = host
    is_unicode = decoded != host or any(ord(c) > 127 for c in host)
    ip = _is_ip(host)
    ext = tld(decoded)
    registered = host if ip else ".".join(p for p in (ext.domain, ext.suffix) if p)
    display = (raw if scheme or ip else raw)
    return UrlInfo(
        raw=raw, display=display, host=decoded, registered=registered.lower(),
        label=ext.domain.lower(), suffix=ext.suffix.lower(), subdomain=ext.subdomain.lower(),
        path=parts.path or "", scheme=scheme, is_ip=ip,
        has_userinfo=("@" in parts.netloc), is_unicode=is_unicode,
    )


def _fold(label: str) -> str:
    """Undo look-alike tricks: other alphabets, leetspeak, 'rn' -> 'm'. Keeps hyphens."""
    s = label.translate(CONFUSABLES).lower()
    s = "".join(LEET.get(c, c) for c in s)
    return s.replace("rn", "m").replace("vv", "w")


def _plain(label: str) -> str:
    return _fold(label).replace("-", "")


def _variants(label: str) -> set[str]:
    base = _plain(label)
    return {base.replace("1", "l"), base.replace("1", "i")}


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


_COMMON_OK_SUFFIX = {"com", "org", "net"}


def is_official(info: UrlInfo, brand: Brand) -> bool:
    if info.registered in brand.domains:
        return True
    if brand.country_variants and info.label == brand.label:
        parts = info.suffix.split(".")
        is_cc = len(parts[-1]) == 2 and parts[-1] not in SUSPICIOUS_TLDS
        return is_cc and (len(parts) == 1 or parts[0] in {"co", "com", "net", "org"})
    return False


def official_brands(info: UrlInfo) -> list[Brand]:
    return [b for b in BRANDS if is_official(info, b)]


def _sig(id, label, severity, detail, info, matched=None, kind="evidence", category="link", extra=None):
    related = [info.display, info.registered] + (extra or [])
    return Signal(
        id=id, label=label, kind=kind, category=category, severity=severity,
        detail=detail, matched=matched or [info.display], related=related,
    )


def domain_signals(info: UrlInfo) -> list[Signal]:
    out: list[Signal] = []
    official = official_brands(info)

    if info.registered in SHORTENERS or info.host in SHORTENERS:
        out.append(_sig("link_shortener", "Link hides its real destination", 15,
                        f"{info.registered} is a link shortener, so you can't see where the link really goes.", info))

    if info.is_ip:
        out.append(_sig("ip_host", "Link uses a raw IP address", 28,
                        "Real organizations almost never send links that point to a bare IP address.", info))

    if info.has_userinfo:
        out.append(_sig("userinfo_trick", "Link contains an '@' trick", 28,
                        "Text before the '@' in a link is ignored by browsers. Scammers use it to make a link look like a trusted site while it goes somewhere else.", info))

    if info.is_unicode:
        out.append(_sig("punycode_domain", "Domain uses unusual characters", 30,
                        "The domain mixes characters from other alphabets. This is a known way to imitate a trusted name.", info))

    if info.path.lower().endswith(EXECUTABLE_EXT):
        out.append(_sig("executable_link", "Link downloads an app or program file", 32,
                        "The link points to an installable file. Installing apps from links in messages is a common way to spread malware.", info))

    if not official:
        out.extend(_brand_signals(info))
        if info.suffix.split(".")[-1] in SUSPICIOUS_TLDS:
            out.append(_sig("suspicious_tld", f"Uses the .{info.suffix.split('.')[-1]} ending", 8,
                            "This domain ending is cheap and often used for throwaway sites. Many legitimate sites exist on it too, so this is a weak sign on its own.", info))
        host_words = [w for w in RISKY_WORDS if w in info.label or w in info.subdomain]
        if host_words and not info.is_ip:
            out.append(_sig("risky_words_in_domain", "Domain contains words like 'login' or 'verify'", 8,
                            f"The domain contains {', '.join(repr(w) for w in host_words[:3])}. Scam sites often add such words to look official.", info,
                            matched=[info.host]))
        if not info.is_ip and (info.label.count("-") >= 3 or info.subdomain.count(".") >= 2 or sum(c.isdigit() for c in info.label) >= 4):
            out.append(_sig("odd_domain_shape", "Domain looks machine-made or cluttered", 6,
                            "It has many hyphens, many subdomain levels, or many digits. Real brands usually keep domains short and clean.", info,
                            matched=[info.host]))
    if info.scheme == "http":
        out.append(_sig("insecure_http", "Link is not encrypted (http)", 5,
                        "The link doesn't use https. Sites that ask for logins or payments should.", info))
    return out


def _brand_signals(info: UrlInfo) -> list[Signal]:
    out: list[Signal] = []
    label_variants = _variants(info.label)
    sub_tokens = {t for part in info.subdomain.split(".") for t in re.split(r"[-]", part) if t}
    for brand in BRANDS:
        if is_official(info, brand):
            continue
        b = brand.label
        extra = [brand.name]
        # 1. Brand name used as a subdomain of something unrelated: paypal.secure-login.com
        if b in sub_tokens or f"{b}.com" in info.host.replace(info.registered, ""):
            out.append(_sig("brand_in_subdomain", f"Uses '{brand.name}' as a subdomain of another site", 48,
                            f"The link starts with '{b}' but the actual site is {info.registered}, which is not {brand.name}'s official domain.", info, extra=extra, matched=[info.host]))
            break
        # 2. Look-alike spelling (leetspeak, other alphabets, one letter off)
        lookalike = (info.label != b and b in label_variants) or (
            len(b) >= 6 and len(info.label) >= 5 and levenshtein(_plain(info.label), b) == 1
            and info.label != b and abs(len(info.label) - len(b)) <= 1
        )
        if lookalike:
            out.append(_sig("lookalike_domain", f"Domain imitates {brand.name}", 45,
                            f"{info.registered} is spelled to look like '{b}' but is not {brand.name}'s official domain. This is a classic fake-website trick.", info, extra=extra))
            break
        # 3. Exact brand name on an unofficial ending: paypal.xyz
        if info.label == b:
            out.append(_sig("brand_unofficial_tld", f"Uses the name '{brand.name}' on an unofficial domain", 34,
                            f"The domain uses '{b}' but ends in .{info.suffix}. {brand.name}'s official domains are {', '.join(sorted(brand.domains))}.", info, extra=extra))
            break
        # 4. Brand name embedded in a longer, unrelated domain: paypal-secure-verify.xyz
        def embedded(lbl: str) -> bool:
            return b in lbl.split("-") or (len(b) >= 6 and b in lbl)

        folded = _fold(info.label)
        fold_hit = any(embedded(v) for v in (folded.replace("1", "l"), folded.replace("1", "i")))
        if fold_hit and not embedded(info.label):
            out.append(_sig("lookalike_domain", f"Domain imitates {brand.name}", 45,
                            f"{info.registered} hides '{b}' behind swapped characters (like 0 for o) and isn't {brand.name}'s official domain. This is a classic fake-website trick.", info, extra=extra))
            break
        if embedded(info.label):
            out.append(_sig("brand_embedded_domain", f"Domain contains '{brand.name}' but isn't {brand.name}", 40,
                            f"The domain {info.registered} contains '{b}' but is not {brand.name}'s official domain. Scammers pad real names with extra words to look trustworthy.", info, extra=extra))
            break
    return out
