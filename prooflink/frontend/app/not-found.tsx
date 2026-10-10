import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="max-w-[44ch] text-sm text-muted-foreground">The link may be old or mistyped. Nothing is wrong with your account.</p>
      <Button asChild>
        <Link href="/dashboard">Go to your dashboard</Link>
      </Button>
    </main>
  );
}
