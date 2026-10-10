"""Brand registry used to spot impersonation.

Add your own local banks / wallets / couriers here. `domains` are the official
registered domains. `country_variants` lets amazon.de / amazon.co.uk count as official.
`strict_case` brands share a name with common words, so in text we only match the
capitalised form ("Apple", not "apple").
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Brand:
    name: str
    label: str
    domains: frozenset[str]
    aliases: tuple[str, ...] = ()
    country_variants: bool = False
    strict_case: bool = False


def _b(name, label, domains, aliases=(), country_variants=False, strict_case=False) -> Brand:
    return Brand(name, label, frozenset(domains), tuple(aliases), country_variants, strict_case)


BRANDS: tuple[Brand, ...] = (
    _b("PayPal", "paypal", ["paypal.com", "paypal.me"], country_variants=True),
    _b("Amazon", "amazon", ["amazon.com", "amzn.to", "amzn.com", "a.co"], country_variants=True, strict_case=True),
    _b("Apple", "apple", ["apple.com", "icloud.com"], ["Apple ID", "iCloud"], country_variants=True, strict_case=True),
    _b("Microsoft", "microsoft", ["microsoft.com", "live.com", "office.com", "outlook.com", "microsoftonline.com"], ["Outlook", "Office 365"], country_variants=True),
    _b("Google", "google", ["google.com", "gmail.com", "youtube.com", "goo.gl", "g.co"], ["Gmail"], country_variants=True),
    _b("Facebook", "facebook", ["facebook.com", "fb.com", "fb.me", "meta.com"], ["Meta"], country_variants=True),
    _b("Instagram", "instagram", ["instagram.com"], country_variants=False),
    _b("WhatsApp", "whatsapp", ["whatsapp.com", "wa.me", "whatsapp.net"]),
    _b("Telegram", "telegram", ["telegram.org", "t.me", "telegram.me"]),
    _b("Netflix", "netflix", ["netflix.com"]),
    _b("Spotify", "spotify", ["spotify.com"]),
    _b("LinkedIn", "linkedin", ["linkedin.com", "lnkd.in"]),
    _b("X (Twitter)", "twitter", ["twitter.com", "x.com", "t.co"], ["Twitter"]),
    _b("DHL", "dhl", ["dhl.com"], country_variants=True),
    _b("FedEx", "fedex", ["fedex.com"], country_variants=True),
    _b("UPS", "ups", ["ups.com"], country_variants=True, strict_case=True),
    _b("USPS", "usps", ["usps.com"]),
    _b("Visa", "visa", ["visa.com"], strict_case=True),
    _b("Mastercard", "mastercard", ["mastercard.com"]),
    _b("Binance", "binance", ["binance.com"]),
    _b("Coinbase", "coinbase", ["coinbase.com"]),
    _b("eBay", "ebay", ["ebay.com"], country_variants=True),
    _b("Chase", "chase", ["chase.com"], strict_case=True),
    _b("Bank of America", "bankofamerica", ["bankofamerica.com"]),
    _b("Wells Fargo", "wellsfargo", ["wellsfargo.com"]),
    _b("HSBC", "hsbc", ["hsbc.com"], country_variants=True),
    _b("IRS", "irs", ["irs.gov"], strict_case=True),
)

BRANDS_BY_LABEL = {b.label: b for b in BRANDS}
