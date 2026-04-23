import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm hover:brightness-95",
  secondary:
    "bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[color:rgba(216,232,226,0.95)]",
  outline:
    "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-white/60",
  ghost: "bg-transparent text-[var(--foreground)] hover:bg-white/60",
  destructive: "bg-[var(--danger)] text-white shadow-sm hover:brightness-95",
};

export function Button({
  asChild = false,
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
