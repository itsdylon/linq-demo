import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-2xl border border-[var(--border)] bg-white/80 px-4 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--foreground-soft)]/70 focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[var(--accent)]/15",
        className,
      )}
      {...props}
    />
  );
}
