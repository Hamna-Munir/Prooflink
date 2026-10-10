import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ExampleVerdict } from "@/components/example-verdict";
import { SiteHeader } from "@/components/site-header";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
        <section>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Check before you trust.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg text-muted-foreground">
            Got a message, link, or screenshot that feels off? Paste it into ProofLink. You get a
            plain-language verdict, the evidence behind it, and the safest next step.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Check something</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <p className="mt-6 max-w-[52ch] text-sm text-muted-foreground">
            ProofLink helps you decide. It is not a law-enforcement tool, and it will tell you when
            it is unsure.
          </p>
        </section>

        <ExampleVerdict />
      </main>
    </>
  );
}
