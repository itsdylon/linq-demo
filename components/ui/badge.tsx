import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "bg-white/70 text-[var(--foreground-soft)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneClasses;
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
