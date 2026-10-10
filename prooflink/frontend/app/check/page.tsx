"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AnalysisResult, ResultSkeleton } from "@/components/analysis-result";
import { AppHeader } from "@/components/app-header";
import { ScreenshotPicker } from "@/components/screenshot-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type DemoExample, type InvestigationDetail } from "@/lib/api";
import { useScreenshotOcr } from "@/lib/ocr";
import { useRequireUser } from "@/lib/use-user";

export default function CheckPage() {
  const router = useRouter();
  const { user, error: loadError } = useRequireUser();
  const [content, setContent] = useState("");
  const [result, setResult] = useState<InvestigationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [examples, setExamples] = useState<DemoExample[]>([]);
  // "screenshot" once the text came from an uploaded image (the user may still edit it)
  const [source, setSource] = useState<"message" | "screenshot">("message");
  const resultRef = useRef<HTMLElement>(null);
  const ocr = useScreenshotOcr((text) => {
    setContent(text);
    setSource("screenshot");
    setError(null);
  });

  useEffect(() => {
    api.demoExamples().then(setExamples).catch(() => setExamples([]));
    api.health().then((h) => setAiEnabled(h.ai_enabled)).catch(() => setAiEnabled(false));
  }, []);

  // When a result arrives: bring it into view and move focus to it (for keyboard and screen-reader users).
  useEffect(() => {
    if (!result) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    resultRef.current?.focus({ preventScroll: true });
  }, [result, runId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.createInvestigation(content, source === "screenshot" ? "screenshot" : undefined));
      setRunId((n) => n + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loadError) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{loadError}</main>;
  }
  if (!user) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</main>;
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Check something</h1>
        <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
          Paste a message, an email, or a link that feels off. ProofLink looks for scam warning signs and tells
          you what to do next.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Message or link</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (!e.target.value.trim()) setSource("message");
              }}
              onPaste={(e) => {
                // Pasting a screenshot (Ctrl+V / Cmd+V) reads its text instead of inserting nothing
                const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
                if (img) {
                  e.preventDefault();
                  void ocr.run(img);
                }
              }}
              maxLength={10000}
              placeholder="Paste the suspicious message or link here"
              aria-describedby="content-help"
            />
            <p id="content-help" className="text-xs text-muted-foreground">
              Don&apos;t include your own passwords or codes. ProofLink never opens the links you paste.
              {aiEnabled && " Your text is also sent to an AI service to help analyse it."}
            </p>
          </div>

          <ScreenshotPicker
            state={ocr.state}
            onFile={(file) => void ocr.run(file)}
            onRemove={() => {
              ocr.reset();
              if (source === "screenshot") {
                setContent("");
                setSource("message");
              }
            }}
            disabled={loading}
          />

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={loading || !content.trim()}>
              {loading ? "Checking…" : "Check this"}
            </Button>
            {(content || result) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setContent("");
                  setResult(null);
                  setError(null);
                  setSource("message");
                  ocr.reset();
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {examples.length > 0 && !content && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">Or try an example</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <Button key={ex.id} type="button" variant="outline" size="sm" onClick={() => { setContent(ex.text); setSource("message"); ocr.reset(); }}>
                    {ex.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </form>

        {(loading || result) && (
          <div className="mt-10 scroll-mt-6">
            {!loading && result && (
              <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-risk-safe" aria-hidden />
                Saved to your history.
                <Link href={`/history/${result.id}`} className="font-medium text-foreground underline underline-offset-4">
                  Open it
                </Link>
              </p>
            )}
            {loading ? <ResultSkeleton /> : result && <AnalysisResult key={runId} ref={resultRef} analysis={result.analysis} />}
          </div>
        )}
      </main>
    </>
  );
}
