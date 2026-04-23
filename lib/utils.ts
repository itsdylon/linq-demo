import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function truncate(value: string | undefined, max = 180) {
  if (!value) {
    return "";
  }

  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function joinMultilineIds(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).join("\n");
}

export function splitMultilineIds(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function safeJsonStringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function normalizeDateInput(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

export function getConfidenceTone(confidence: number) {
  if (confidence >= 0.8) {
    return "accent";
  }
  if (confidence >= 0.5) {
    return "warning";
  }
  return "danger";
}
