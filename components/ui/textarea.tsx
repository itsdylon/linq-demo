import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-3xl border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--foreground-soft)]/70 focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/15",
        className,
      )}
      {...props}
    />
  );
}
