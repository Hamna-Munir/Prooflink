"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type OcrStatus = "idle" | "reading" | "done" | "error";

export type OcrState = {
  status: OcrStatus;
  progress: number; // 0-100
  previewUrl: string | null;
  fileName: string | null;
  error: string | null;
};

const IDLE: OcrState = { status: "idle", progress: 0, previewUrl: null, fileName: null, error: null };

function tidy(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reads the text out of a screenshot, entirely inside the browser (tesseract.js).
 * The image is never uploaded: only the extracted text goes on to the normal check.
 * The OCR engine and English language data are downloaded the first time it is used.
 */
export function useScreenshotOcr(onText: (text: string) => void) {
  const [state, setState] = useState<OcrState>(IDLE);
  const latest = useRef(0); // ignore results from a run the user has since replaced or removed
  const previewRef = useRef<string | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const dropPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  };

  useEffect(() => () => dropPreview(), []);

  const reset = useCallback(() => {
    latest.current++;
    dropPreview();
    setState(IDLE);
  }, []);

  const run = useCallback(async (file: File) => {
    const id = ++latest.current;
    dropPreview();

    if (!OK_TYPES.includes(file.type)) {
      setState({ ...IDLE, status: "error", error: "Please choose a PNG, JPG or WebP image." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setState({ ...IDLE, status: "error", error: "That image is larger than 8 MB. Crop it or use a smaller screenshot." });
      return;
    }

    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setState({ status: "reading", progress: 0, previewUrl: url, fileName: file.name, error: null });

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (id === latest.current && m.status === "recognizing text") {
            setState((s) => ({ ...s, progress: Math.round(m.progress * 100) }));
          }
        },
      });
      let text = "";
      try {
        const { data } = await worker.recognize(file);
        text = tidy(data.text);
      } finally {
        await worker.terminate();
      }
      if (id !== latest.current) return;

      if (text.replace(/\s/g, "").length < 5) {
        setState((s) => ({
          ...s,
          status: "error",
          error: "We couldn't find readable text in that image. Try a sharper or larger screenshot, or paste the text instead.",
        }));
        return;
      }
      onTextRef.current(text.slice(0, 10_000));
      setState((s) => ({ ...s, status: "done", progress: 100 }));
    } catch {
      if (id !== latest.current) return;
      setState((s) => ({
        ...s,
        status: "error",
        error:
          "We couldn't read that image. The text reader downloads a small language file the first time, so check your internet connection, or paste the text instead.",
      }));
    }
  }, []);

  return { state, run, reset };
}
