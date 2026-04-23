import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const fullEnvSchema = z.object({
  AIRTABLE_BASE_ID: z.string().min(1),
  AIRTABLE_PAT: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  BASE_URL: z.string().url(),
  DASHBOARD_PASSWORD: z.string().min(1),
  LINQ_API_KEY: z.string().min(1),
  LINQ_PHONE_NUMBER: z.string().min(1),
  LINQ_WEBHOOK_SECRET: z.string().min(1).optional(),
  LINQ_WEBHOOK_SUBSCRIPTION_ID: z.string().optional(),
  SESSION_SECRET: z.string().min(16),
});

const airtableEnvSchema = fullEnvSchema.pick({
  AIRTABLE_BASE_ID: true,
  AIRTABLE_PAT: true,
});

const extractionEnvSchema = fullEnvSchema.pick({
  ANTHROPIC_API_KEY: true,
  ANTHROPIC_MODEL: true,
});

const dashboardEnvSchema = fullEnvSchema.pick({
  DASHBOARD_PASSWORD: true,
});

const linqAdminEnvSchema = fullEnvSchema.pick({
  BASE_URL: true,
  LINQ_API_KEY: true,
  LINQ_PHONE_NUMBER: true,
  LINQ_WEBHOOK_SUBSCRIPTION_ID: true,
});

const webhookEnvSchema = fullEnvSchema.pick({
  LINQ_WEBHOOK_SECRET: true,
});

export type Env = z.infer<typeof fullEnvSchema>;
export type AirtableEnv = z.infer<typeof airtableEnvSchema>;
export type ExtractionEnv = z.infer<typeof extractionEnvSchema>;
export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;
export type LinqAdminEnv = z.infer<typeof linqAdminEnvSchema>;
export type WebhookEnv = z.infer<typeof webhookEnvSchema>;

let didLoadEnvFiles = false;

function parseDotEnvFile(contents: string) {
  const parsed: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const separatorIndex = withoutExport.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = withoutExport.slice(0, separatorIndex).trim();
    let value = withoutExport.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function ensureEnvFilesLoaded() {
  if (didLoadEnvFiles) {
    return;
  }

  didLoadEnvFiles = true;

  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const contents = fs.readFileSync(filePath, "utf8");
    const parsed = parseDotEnvFile(contents);

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function getRawEnv() {
  ensureEnvFilesLoaded();

  return {
    AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
    AIRTABLE_PAT: process.env.AIRTABLE_PAT,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    BASE_URL: process.env.BASE_URL,
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
    LINQ_API_KEY: process.env.LINQ_API_KEY,
    LINQ_PHONE_NUMBER: process.env.LINQ_PHONE_NUMBER,
    LINQ_WEBHOOK_SECRET: process.env.LINQ_WEBHOOK_SECRET,
    LINQ_WEBHOOK_SUBSCRIPTION_ID: process.env.LINQ_WEBHOOK_SUBSCRIPTION_ID,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
}

export function getEnv(): Env {
  return fullEnvSchema.parse(getRawEnv());
}

export function getAirtableEnv(): AirtableEnv {
  return airtableEnvSchema.parse(getRawEnv());
}

export function getExtractionEnv(): ExtractionEnv {
  return extractionEnvSchema.parse(getRawEnv());
}

export function getDashboardEnv(): DashboardEnv {
  return dashboardEnvSchema.parse(getRawEnv());
}

export function getLinqAdminEnv(): LinqAdminEnv {
  return linqAdminEnvSchema.parse(getRawEnv());
}

export function getWebhookEnv(): WebhookEnv {
  return webhookEnvSchema.parse(getRawEnv());
}
