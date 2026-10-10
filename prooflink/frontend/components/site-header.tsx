import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
      <ShieldCheck className="h-8 w-8 text-primary" aria-hidden />
      ProofLink
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Create account</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
