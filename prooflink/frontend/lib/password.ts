// Mirrors backend/app/password_policy.py. The server is the real gate; this gives live feedback.

export const MIN_LENGTH = 8;

const COMMON_BASES = new Set([
  "password", "passwort", "passw", "qwerty", "qwertyuiop", "letmein", "welcome", "iloveyou",
  "admin", "administrator", "login", "abc", "abcdef", "monkey", "dragon", "football",
  "baseball", "master", "sunshine", "princess", "shadow", "superman", "trustno", "prooflink",
  "changeme", "secret", "test", "testing", "guest", "hello", "freedom", "whatever",
]);
const LEET: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "@": "a", $: "s", "!": "i", "7": "t" };

export type PasswordRule = { id: string; label: string; ok: boolean };
export type Strength = "empty" | "weak" | "okay" | "strong";

export type PasswordCheck = {
  rules: PasswordRule[];
  problem: string | null; // first thing wrong, as a sentence
  valid: boolean;
  strength: Strength;
};

function bases(pw: string): string[] {
  const core = pw.toLowerCase().replace(/[^a-z]+$/, "");
  const leet = core.replace(/./g, (c) => LEET[c] ?? c);
  return [core.replace(/[^a-z]/g, ""), leet.replace(/[^a-z]/g, "")];
}

export function evaluatePassword(pw: string, ctx: { email?: string; name?: string } = {}): PasswordCheck {
  const rules: PasswordRule[] = [
    { id: "length", label: `At least ${MIN_LENGTH} characters`, ok: pw.length >= MIN_LENGTH },
    { id: "lower", label: "A lowercase letter", ok: /[a-z]/.test(pw) },
    { id: "upper", label: "An uppercase letter", ok: /[A-Z]/.test(pw) },
    { id: "number", label: "A number", ok: /\d/.test(pw) },
    { id: "symbol", label: "A symbol such as ! @ # $", ok: /[^A-Za-z0-9\s]/.test(pw) },
  ];

  let problem: string | null = null;
  const missing = rules.filter((r) => !r.ok).map((r) => r.label.charAt(0).toLowerCase() + r.label.slice(1));
  if (missing.length) {
    problem = `Password is too weak. It needs ${missing.join(", ")}.`;
  } else if (bases(pw).some((b) => COMMON_BASES.has(b))) {
    problem = "That password is too common. Choose something harder to guess.";
  } else {
    const lowered = pw.toLowerCase();
    const local = (ctx.email ?? "").split("@")[0].toLowerCase();
    const parts = (ctx.name ?? "").toLowerCase().split(/[^a-z]+/).filter((p) => p.length >= 4);
    if ((local.length >= 4 && lowered.includes(local)) || parts.some((p) => lowered.includes(p))) {
      problem = "Don't use your name or email address inside your password.";
    }
  }

  const valid = problem === null;
  const strength: Strength = !pw ? "empty" : !valid ? "weak" : pw.length >= 12 ? "strong" : "okay";
  return { rules, problem, valid, strength };
}
