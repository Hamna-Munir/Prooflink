"use client";

import { ImageUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { OcrState } from "@/lib/ocr";
import { cn } from "@/lib/utils";

type Props = {
  state: OcrState;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
};

// Choose or drop a screenshot. The text is read in the browser and placed in the box above.
export function ScreenshotPicker({ state, onFile, onRemove, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = state.status === "reading";

  function take(files: FileList | null) {
    const f = files?.[0];
    if (f) onFile(f);
    if (input.current) input.current.value = ""; // allow choosing the same file again
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled && !busy) take(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-dashed border-border bg-card/50 p-4 transition-colors",
        dragging && "border-primary bg-primary/5"
      )}
    >
      <input
        ref={input}
        id="screenshot-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => take(e.target.files)}
        disabled={disabled || busy}
      />

      {state.status === "idle" || state.status === "error" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Have a screenshot instead?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Choose or drop an image (PNG, JPG or WebP, up to 8 MB), or paste one into the box above. The text is read
              in your browser. The image itself is never uploaded.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => input.current?.click()} disabled={disabled}>
            <ImageUp className="h-4 w-4" aria-hidden />
            Upload screenshot
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {state.previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.previewUrl} alt="The screenshot you chose" className="h-16 w-16 shrink-0 rounded-md border border-border object-cover" />
          )}
          <div className="min-w-0 flex-1" role="status" aria-live="polite">
            <p className="truncate text-sm font-medium">{state.fileName}</p>
            {busy ? (
              <>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Reading the text… {state.progress > 0 ? `${state.progress}%` : "getting ready"}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(state.progress, 4)}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Text added above. Read it through and fix any mistakes before you press Check this.
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Remove screenshot">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}

      {state.status === "error" && state.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
