"""Step 7-8: plain-language explanation and recommended actions (rule-based baseline).

Phase 4 adds an LLM that rewrites the explanation, but the structure and hedging live here
so the product stays honest even if the model is unavailable.
"""
from app.analysis.result import RiskLevel, Signal

HEADLINES = {
    "HIGH_RISK": "Several strong warning signs point the same way.",
    "SUSPICIOUS": "Some warning signs showed up, but the picture isn't clear-cut.",
    "SAFE": "We didn't find common scam warning signs.",
}


def scam_type(ids: set[str]) -> str:
    if ids & {"lookalike_domain", "brand_in_subdomain", "brand_embedded_domain", "brand_unofficial_tld", "punycode_domain"} or (
        "credential_request" in ids and ("click_to_verify" in ids or "account_threat" in ids)
    ):
        return "phishing attempt (a fake login or verification request)"
    if "investment_scam" in ids:
        return "investment scam"
    if "job_scam" in ids:
        return "fake job offer"
    if "reward_scam" in ids:
        return "prize or reward scam"
    if "delivery_notice" in ids:
        return "fake delivery notice"
    if "family_impersonation" in ids:
        return "message from someone pretending to be a person you know"
    if "legal_threat" in ids:
        return "intimidation scam"
    if ids & {"payment_request", "untraceable_payment"}:
        return "payment scam"
    return "scam or phishing attempt"


def build_explanation(level: RiskLevel, signals: list[Signal]) -> str:
    ids = {s.id for s in signals}
    top = sorted(signals, key=lambda s: -s.severity)[:3]
    reasons = "; ".join(s.label[0].lower() + s.label[1:] for s in top)
    if level == "SAFE":
        if not signals:
            return ("We checked the text and any links for common scam patterns and found none. "
                    "That doesn't prove it is safe, because we can't verify who sent it.")
        return (f"We noticed a minor point ({reasons}), but nothing that points strongly to a scam. "
                "That doesn't prove it is safe, because we can't verify who sent it.")
    kind = scam_type(ids)
    if level == "HIGH_RISK":
        return (f"This resembles a {kind}. The main reasons: {reasons}. We can't confirm who sent it, "
                "but the pattern matches how these scams usually work, so treat it as unsafe until you check "
                "through an official channel you already trust.")
    return (f"This may be a {kind}, but the evidence is mixed. What stood out: {reasons}. "
            "We can't confirm who sent it, so be careful and verify before you act.")


def build_actions(level: RiskLevel, signals: list[Signal], has_link: bool) -> list[str]:
    ids = {s.id for s in signals}
    acts: list[str] = []
    if level == "SAFE":
        acts.append("Still be careful: if this later asks for money, codes or personal details, stop and check with the sender another way.")
        if has_link:
            acts.append("Type the website address yourself instead of tapping links when you're about to log in or pay.")
        return acts
    if has_link:
        acts.append("Don't open the link in this message.")
    if "install_request" in ids or "executable_link" in ids:
        acts.append("Don't install any app or open any file that came with this message.")
    if "credential_request" in ids:
        acts.append("Never share OTPs, PINs, passwords or card details. Real organizations don't ask for them by message.")
    if ids & {"payment_request", "untraceable_payment"}:
        acts.append("Don't send money, gift cards or crypto. If you already paid, contact your bank or payment provider right away.")
    if ids & {"brand_link_mismatch", "lookalike_domain", "brand_in_subdomain", "brand_embedded_domain",
              "brand_unofficial_tld", "authority_claim", "account_threat",
              "ai_brand_impersonation", "ai_unusual_sender_claim", "ai_suspicious_request"}:
        acts.append("Check your account by opening the organization's official app or typing its website yourself. Don't use the link or number in the message.")
    if "reward_scam" in ids:
        acts.append("Ignore the prize. You can't win something you never entered.")
    if "job_scam" in ids:
        acts.append("Never pay to get a job. Look the company up independently and check it has a real hiring page.")
    if "investment_scam" in ids:
        acts.append("Don't invest money based on promised returns. Check whether the platform is registered with your country's financial regulator.")
    if "delivery_notice" in ids:
        acts.append("Check the delivery in the courier's official app or website, using the tracking number from your own order.")
    if "family_impersonation" in ids:
        acts.append("Call the person on their old, known number before doing anything.")
    if "callback_request" in ids:
        acts.append("Don't call the number in the message. Use the number printed on your card or on the official website.")
    if level == "HIGH_RISK":
        acts.append("If you already clicked or shared something: change the password for that account, turn on two-step verification, and call your bank if you shared card or bank details.")
    acts.append("Block the sender and report the message as spam or phishing in the app you received it on.")
    return acts[:6]
