import type { InputType } from "@/lib/api";

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function inputTypeLabel(t: InputType): string {
  return t === "url" ? "Link" : t === "screenshot" ? "Screenshot" : "Message";
}
