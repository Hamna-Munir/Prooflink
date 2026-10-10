"""Built-in example messages. Used by the landing page demo and by tests."""

DEMO_EXAMPLES = [
    {
        "id": "account-warning",
        "title": "Account warning SMS",
        "channel": "SMS",
        "text": (
            "PayPal: Your account has been limited. Verify your account within 24 hours to avoid "
            "permanent suspension: https://paypal-secure-verify.xyz/login . "
            "Reply with the 6-digit code we send you."
        ),
    },
    {
        "id": "job-offer",
        "title": "Job offer",
        "channel": "WhatsApp",
        "text": (
            "Congratulations! You've been selected for a work-from-home role. Earn $150 daily, "
            "no experience needed. Message us on WhatsApp to apply."
        ),
    },
    {
        "id": "verification-code",
        "title": "Verification code",
        "channel": "SMS",
        "text": "Your verification code is 482913. Do not share it with anyone. It expires in 10 minutes.",
    },
]
