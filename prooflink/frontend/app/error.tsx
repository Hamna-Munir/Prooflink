"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong on our side</h1>
      <p className="max-w-[44ch] text-sm text-muted-foreground">
        Your saved checks are safe. Try again, and if it keeps happening, reload the page.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
