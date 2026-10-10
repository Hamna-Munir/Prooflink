"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PasswordStrength } from "@/components/password-strength";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { api, ApiError } from "@/lib/api";
import { evaluatePassword } from "@/lib/password";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const check = evaluatePassword(password, { email, name: fullName });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Signup: stop weak passwords before they leave the browser (the server checks again).
    if (isSignup && !check.valid) {
      setError(check.problem ?? "Choose a stronger password.");
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      if (isSignup) await api.signup({ full_name: fullName, email, password });
      else await api.login({ email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Log in to ProofLink"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSignup ? "Your investigations stay private to your account." : "Pick up where you left off."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              autoComplete="name"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            ref={passwordRef}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={isSignup ? "password-help" : undefined}
          />
          {isSignup && (
            <div id="password-help">
              {password ? (
                <PasswordStrength check={check} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use 8 or more characters with upper and lower case letters, a number and a symbol.
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New to ProofLink? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-foreground underline underline-offset-4">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
