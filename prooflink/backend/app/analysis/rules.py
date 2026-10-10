"""Step 4-5: scam-signal detection in the text (English plus common Roman Urdu phrasing).

Each rule is a plain, readable pattern list. Add phrases here to teach ProofLink new tricks.
Rules describe what is literally written, so most are 'evidence'. Rules about who the sender
claims to be are 'inference', because we cannot verify the claim.
"""
import re
from dataclasses import dataclass

from app.analysis.result import Signal


@dataclass(frozen=True)
class Rule:
    id: str
    label: str
    category: str
    kind: str
    severity: int
    detail: str
    patterns: tuple[str, ...]
    negatable: bool = False  # ignore matches preceded by "do not" / "never"


_SENSITIVE = (
    r"(?:otp|one[- ]time (?:pass(?:word|code)|code|pin)|verification code|security code|passcode|"
    r"pin|password|cvv|cvc|card number|card details|bank details|account number|login details|"
    r"login credentials|credentials|ssn|social security|cnic|id card|seed phrase|recovery phrase|private key)"
)

RULES: tuple[Rule, ...] = (
    Rule("urgency", "Pressure to act fast", "pressure", "evidence", 14,
         "Scams rush you so you act before thinking. Real organizations rarely demand action within minutes.",
         (r"\burgent(?:ly)?\b", r"\bimmediate(?:ly)?\b", r"\bright now\b", r"\basap\b", r"\bact now\b",
          r"\blast chance\b", r"\bfinal (?:notice|warning|reminder)\b", r"\bwithin (?:the next )?\d+\s*(?:hours?|hrs?)\b",
          r"\b(?:verify|respond|pay|click|act|update|confirm|reply|call|contact|claim)\b[^.\n]{0,40}\bwithin \d+\s*(?:minutes?|mins?|days?)\b",
          r"\bexpires? (?:today|tonight|soon)\b", r"\bdon'?t delay\b", r"\blimited time\b", r"\bhurry\b",
          r"\bbefore it'?s too late\b", r"\b(?:fori|foran|turant)\b", r"\bjaldi se jaldi\b")),
    Rule("account_threat", "Warns that your account is at risk", "pressure", "evidence", 18,
         "Fake security warnings are the most common way phishing messages get you to click.",
         (r"\b(?:account|card|wallet|number|sim)\b[^.\n]{0,30}\b(?:suspended|blocked|closed|locked|limited|restricted|disabled|deactivated|terminated|frozen|compromised|hacked)\b",
          r"\b(?:unusual|suspicious|unauthori[sz]ed)\s+(?:activity|login|sign-?in|transaction|access|attempt)s?\b",
          r"\b(?:account|sim|card)\b[^.\n]{0,25}\b(?:band|block)\s+(?:ho|kar)\b",
          r"\bpermanent(?:ly)?\s+(?:suspen|block|clos|ban)\w*")),
    Rule("legal_threat", "Threatens legal trouble", "pressure", "evidence", 18,
         "Threats of arrest, fines or court action are used to frighten people into paying.",
         (r"\blegal action\b", r"\blawsuit\b", r"\barrest(?:ed)?\b", r"\bwarrant\b", r"\bcourt (?:order|notice|case)\b",
          r"\bpolice (?:case|complaint|report)\b", r"\bprosecut\w+", r"\bcriminal (?:case|charges?)\b", r"\bfine of\b")),
    Rule("secrecy_request", "Asks you to keep it secret", "pressure", "evidence", 16,
         "Scammers isolate you so no one can warn you. Legitimate organizations don't ask for secrecy.",
         (r"\b(?:don'?t|do not|dont) (?:tell|inform|share this with|contact|call) (?:anyone|anybody|dad|mum|mom|papa|mama|your (?:bank|family|friends|parents|wife|husband)|the bank)\b",
          r"\bkeep (?:this|it) (?:a )?(?:secret|confidential|private)\b")),
    Rule("credential_request", "Asks for a code, password or card details", "request", "evidence", 30,
         "Real banks and services never ask you to send an OTP, PIN or password by message or phone.",
         (rf"\b(?:send|share|give|tell|provide|enter|submit|reply(?: with)?|confirm|verify|forward|read out|type)\b[^.\n]{{0,40}}?\b{_SENSITIVE}\b",
          r"\breply (?:with|to this message with) (?:the |your )?(?:\d+[- ]digit )?(?:code|otp|pin)\b",
          r"\bcode we (?:sent|send|will send|text)\b",
          rf"\b{_SENSITIVE}\s+(?:bata|batao|batain|bhej|bheje|bhejain|share\s+kar)"),
         negatable=True),
    Rule("payment_request", "Asks you to send money or pay a fee", "request", "evidence", 22,
         "Being asked to pay a small fee first is how many delivery, prize and job scams start.",
         (r"\b(?:pay|send|transfer|deposit|remit|wire)\b[^.\n]{0,30}(?:\b(?:fee|fees|fine|charge|charges|deposit|tax|duty|amount|money|funds)\b|[$₹£€]\s?\d|\b(?:rs|pkr|usd)\.?\s?\d)",
          r"\b(?:processing|registration|customs|clearance|delivery|handling|release|activation|admin|insurance|advance) (?:fee|fees|charge|charges|payment)\b",
          r"\bsmall (?:fee|payment|amount)\b", r"\bfee of [$₹£€]?\s?\d",
          r"\b(?:send|transfer|pay|lend)\b[^.\n]{0,30}\b\d[\d,]*\s*(?:pounds|dollars|euros|usd|gbp|rupees|rs|pkr|bucks)\b")),
    Rule("untraceable_payment", "Asks for gift cards, crypto or wire transfer", "request", "evidence", 20,
         "These payment methods are hard to reverse, which is why scammers prefer them.",
         (r"\bgift ?cards?\b", r"\bitunes cards?\b", r"\bwestern union\b", r"\bmoneygram\b", r"\bwire transfer\b",
          r"\b(?:bitcoin|btc|usdt|ethereum|crypto(?:currency)?|binance)\b[^.\n]{0,30}\b(?:send|pay|transfer|deposit|wallet)\b")),
    Rule("click_to_verify", "Asks you to click a link to verify or fix something", "request", "evidence", 14,
         "Phishing messages push you to a link where a fake page collects your details.",
         (r"\b(?:click|tap|open|follow|visit)\b[^.\n]{0,25}\b(?:link|here|below|url|button)\b",
          r"\bverify (?:your )?(?:account|identity|details|information|payment|card|email|number)\b",
          r"\blog ?in (?:to|here|now)\b", r"\bsign ?in (?:to|here|now)\b",
          r"\b(?:update|confirm|restore|reactivate|unlock|secure) your (?:account|details|information|billing|payment|password|profile|identity|card)\b",
          r"\blink (?:pe|par|per) click\b", r"\bclick kar(?:en|ein|o)\b")),
    Rule("install_request", "Asks you to install an app or open a file", "request", "evidence", 16,
         "Apps and files sent through messages can hide spyware or remote-control tools.",
         (r"\b(?:install|download)\b[^.\n]{0,25}\b(?:app|apk|software|update|attachment|file)\b", r"\bopen the attached\b",
          r"\bremote (?:access|control)\b", r"\banydesk\b", r"\bteamviewer\b", r"\.apk\b")),
    Rule("callback_request", "Asks you to call a phone number", "request", "evidence", 12,
         "Scammers use phone numbers in messages to talk you into sharing details or paying.",
         (r"\b(?:call|dial|phone|contact)\b[^.\n]{0,25}\+?\d[\d\s().\-]{7,}\d",)),
    Rule("reward_scam", "Says you won a prize or reward", "scam_type", "evidence", 24,
         "Unexpected prizes are bait. You can't win a contest you never entered.",
         (r"\byou(?:'ve| have)? (?:won|been selected|been chosen)\b", r"\bcongratulations\b", r"\bwinner\b",
          r"\blucky draw\b", r"\blottery\b", r"\bclaim your (?:reward|prize|gift|bonus)\b",
          r"\bfree (?:gift|iphone|cash|money)\b", r"\b(?:inaam|inam)\b", r"\bselected for\b")),
    Rule("job_scam", "Looks like a too-good-to-be-true job offer", "scam_type", "evidence", 22,
         "Fake job offers promise easy money, then ask for fees or personal details.",
         (r"\bwork[- ]from[- ]home\b", r"\bearn \$?\s?\d+[\d,]*\s*(?:per|a|/|daily|every)\b", r"\bearn \$?\s?\d+[\d,]*\s+daily\b",
          r"\bpart[- ]?time job\b", r"\bno experience (?:needed|required|necessary)\b", r"\beasy money\b",
          r"\bhiring (?:immediately|urgent)", r"\bdaily (?:income|salary|payment|pay)\b",
          r"\b(?:liking|like) (?:videos|posts)\b", r"\btasks? (?:to|and) earn\b")),
    Rule("investment_scam", "Promises guaranteed or very high returns", "scam_type", "evidence", 28,
         "No legitimate investment can guarantee profit. Promised returns are the hook in most investment scams.",
         (r"\bguaranteed (?:return|profit|income)s?\b", r"\bdouble your (?:money|investment|bitcoin|crypto)\b", r"\brisk[- ]free\b",
          r"\b\d+\s?% (?:daily|weekly|monthly|per (?:day|week|month)) (?:return|profit|interest)s?\b",
          r"\bcrypto(?:currency)? (?:signal|investment|trading)s?\b", r"\bforex (?:signal|trading|profit)s?\b",
          r"\binsider (?:tip|trade|info)\b", r"\bpassive income\b", r"\binvest now\b")),
    Rule("delivery_notice", "Looks like a delivery-problem notice", "scam_type", "evidence", 10,
         "Fake courier notices are very common. On their own they are weak, but they matter when paired with a link or a fee.",
         (r"\b(?:parcel|package|shipment|delivery|courier)\b[^.\n]{0,50}\b(?:on hold|held|could not be|couldn'?t be|unable to|failed|pending|missed|undeliverable|returned|stuck)\b",
          r"\b(?:reschedule|redeliver|confirm) (?:your |the )?(?:delivery|address|shipment)\b")),
    Rule("family_impersonation", "Claims to be someone you know on a new number", "scam_type", "inference", 14,
         "'Hi Mum, this is my new number' messages are a known scam. We can't verify who is really writing.",
         (r"\b(?:hi|hello|hey)\s+(?:mum|mom|mama|dad|papa)\b", r"\bthis is my new (?:number|phone)\b",
          r"\bi (?:lost|broke|dropped) my phone\b", r"\bsave (?:this|my new) number\b",
          r"\bmy (?:old )?(?:phone|number) (?:is|was) (?:broken|lost|damaged)\b")),
    Rule("authority_claim", "Claims to be a bank, support team or official", "scam_type", "inference", 12,
         "Scammers pose as authorities to be believed. We can't verify who actually sent this.",
         (r"\b(?:it'?s|this is|my name is|i'?m|i am) \w+ from (?:the )?(?:\w+ )?(?:support|security|fraud|helpdesk|customer (?:care|service)|technical|bank|police|tax)\b",
          r"\bthis is (?:the |your )?(?:bank|customer (?:care|support|service)|security (?:team|department)|fraud (?:team|department)|police|tax (?:office|department)|support team|helpdesk|it department)\b",
          r"\bi am (?:calling |writing )?from (?:the )?(?:bank|police|customs|tax|support|microsoft|amazon|apple)\b",
          r"\b(?:officer|inspector|agent|manager|director) [a-z]+ from\b")),
    Rule("off_platform_contact", "Pushes you to chat on WhatsApp or Telegram", "contact", "evidence", 10,
         "Moving you to a private chat app takes you away from platforms that could detect the scam.",
         (r"\b(?:contact|message|text|chat|reach|dm|whatsapp|add) (?:us|me)\b[^.\n]{0,25}\b(?:whatsapp|telegram|signal)\b",
          r"\b(?:whatsapp|telegram)\b[^.\n]{0,25}\b(?:to apply|to claim|for details|for more info|to join)\b")),
    Rule("generic_greeting", "Generic greeting instead of your name", "contact", "evidence", 6,
         "Mass-sent scam messages rarely know your name.",
         (r"\bdear (?:valued )?(?:customer|user|client|member|account holder|sir/madam|sir or madam|beneficiary|winner)\b",)),
)

_NEGATION = re.compile(r"(?:do not|don'?t|dont|never|not|won'?t|no one|nobody)\b[^.\n]{0,30}$", re.I)
_COMPILED = [(r, [re.compile(p, re.I) for p in r.patterns]) for r in RULES]


def detect_text_signals(text: str) -> list[Signal]:
    out: list[Signal] = []
    for rule, patterns in _COMPILED:
        snippets: list[str] = []
        for pat in patterns:
            for m in pat.finditer(text):
                if rule.negatable and _NEGATION.search(text[max(0, m.start() - 40): m.start()]):
                    continue  # "Do not share your OTP" is a warning, not a request
                snip = " ".join(m.group(0).split())[:90]
                if snip.lower() not in (s.lower() for s in snippets):
                    snippets.append(snip)
        if snippets:
            out.append(Signal(
                id=rule.id, label=rule.label, kind=rule.kind, category=rule.category,  # type: ignore[arg-type]
                severity=rule.severity, detail=rule.detail, matched=snippets[:3],
            ))
    return out
