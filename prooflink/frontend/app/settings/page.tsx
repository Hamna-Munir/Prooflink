"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { PasswordStrength } from "@/components/password-strength";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api, ApiError, type User } from "@/lib/api";
import { evaluatePassword } from "@/lib/password";
import { useRequireUser } from "@/lib/use-user";

function Section({ title, description, danger, children }: { title: string; description?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border bg-card p-5 sm:p-6 ${danger ? "border-destructive/40" : "border-border"}`}>
      <h2 className={`text-base font-semibold ${danger ? "text-destructive" : ""}`}>{title}</h2>
      {description && <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Notice({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return ok ? (
    <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-risk-safe">
      <Check className="h-4 w-4" aria-hidden />
      {children}
    </p>
  ) : (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

const msg = (err: unknown) => (err instanceof ApiError ? err.message : "Could not reach the server. Try again.");

function ProfileSection({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [name, setName] = useState(user.full_name);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== user.full_name;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    try {
      const updated = await api.updateProfile({ full_name: name });
      onSaved(updated);
      setName(updated.full_name);
      setState({ ok: true, text: "Saved." });
    } catch (err) {
      setState({ ok: false, text: msg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Profile">
      <form onSubmit={save} className="max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled aria-describedby="email-help" />
          <p id="email-help" className="text-xs text-muted-foreground">Your email is your login, so it can&apos;t be changed here.</p>
        </div>
        {state && <Notice ok={state.ok}>{state.text}</Notice>}
        <Button type="submit" disabled={busy || !changed || name.trim().length < 2}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Section>
  );
}

function PasswordSection({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const check = evaluatePassword(next, { email: user.email, name: user.full_name });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState(null);
    if (!check.valid) {
      setState({ ok: false, text: check.problem ?? "Choose a stronger password." });
      return;
    }
    setBusy(true);
    try {
      await api.changePassword({ current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setState({ ok: true, text: "Password changed." });
    } catch (err) {
      setState({ ok: false, text: msg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Password">
      <form onSubmit={save} className="max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current_password">Current password</Label>
          <PasswordInput id="current_password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new_password">New password</Label>
          <PasswordInput id="new_password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          {next && <PasswordStrength check={check} />}
        </div>
        {state && <Notice ok={state.ok}>{state.text}</Notice>}
        <Button type="submit" disabled={busy || !current || !next}>
          {busy ? "Changing…" : "Change password"}
        </Button>
      </form>
    </Section>
  );
}

function DataSection({ total, aiEnabled, onCleared }: { total: number | null; aiEnabled: boolean | null; onCleared: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);

  async function clear() {
    setBusy(true);
    setState(null);
    try {
      await api.deleteAllInvestigations();
      onCleared();
      setConfirming(false);
      setState({ ok: true, text: "Your history is empty." });
    } catch (err) {
      setState({ ok: false, text: msg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Your data"
      description="Everything you check is saved only to your account, and only you can open it."
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Saved checks</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{total ?? "…"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">AI review</dt>
          <dd className="mt-0.5 leading-relaxed">
            {aiEnabled === null
              ? "…"
              : aiEnabled
                ? "On. The text you check is also sent to an AI service to help analyse it. Links are never opened."
                : "Off. Checks use ProofLink's built-in rules only, and your text goes nowhere else."}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Screenshots are read in your browser. The image itself is never uploaded or stored.
      </p>

      <div className="mt-5 border-t border-border pt-5">
        {state && <div className="mb-3"><Notice ok={state.ok}>{state.text}</Notice></div>}
        {!confirming ? (
          <Button type="button" variant="outline" onClick={() => setConfirming(true)} disabled={!total}>
            Delete all my history
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Delete all {total} saved checks? This can&apos;t be undone.</p>
            <Button type="button" className="bg-destructive text-white hover:bg-destructive/90" onClick={clear} disabled={busy}>
              {busy ? "Deleting…" : "Yes, delete everything"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(msg(err));
      setBusy(false);
    }
  }

  return (
    <Section
      danger
      title="Delete account"
      description="Permanently deletes your account and every saved check. This can't be undone."
    >
      {!open ? (
        <Button type="button" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      ) : (
        <form onSubmit={remove} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete_password">Enter your password to confirm</Label>
            <PasswordInput id="delete_password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <Notice>{error}</Notice>}
          <div className="flex gap-3">
            <Button type="submit" className="bg-destructive text-white hover:bg-destructive/90" disabled={busy || !password}>
              {busy ? "Deleting…" : "Delete account for good"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setPassword(""); setError(null); }} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

export default function SettingsPage() {
  const { user, error } = useRequireUser();
  const [profile, setProfile] = useState<User | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    api.stats().then((s) => setTotal(s.total)).catch(() => setTotal(null));
    api.health().then((h) => setAiEnabled(h.ai_enabled)).catch(() => setAiEnabled(null));
  }, [user]);

  if (error) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{error}</main>;
  }
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</main>;
  }
  const current = profile ?? user;

  return (
    <>
      <AppHeader user={current} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account, your password, and what ProofLink keeps.</p>
        <div className="mt-8 space-y-6">
          <ProfileSection user={current} onSaved={setProfile} />
          <PasswordSection user={current} />
          <DataSection total={total} aiEnabled={aiEnabled} onCleared={() => setTotal(0)} />
          <DeleteAccountSection />
        </div>
      </main>
    </>
  );
}
