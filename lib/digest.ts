import type { ItemRecord, ProjectRecord } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/utils";

const TYPE_ORDER = [
  "Decision",
  "Action",
  "Budget",
  "Schedule",
  "Product",
  "Address",
  "Question",
  "Other",
] as const;

export function buildDigestMarkdown(
  project: ProjectRecord,
  items: ItemRecord[],
) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`## Project update — ${project.name} — ${today}`, ""];

  for (const type of TYPE_ORDER) {
    const sectionItems = items.filter((item) => item.type === type);
    if (sectionItems.length === 0) {
      continue;
    }

    lines.push(`### ${type === "Action" ? "Action items" : `${type}s`}`);

    for (const item of sectionItems) {
      const metaParts = [
        item.owner && item.owner !== "Unknown" ? `[${item.owner}]` : null,
        item.due ? `due ${formatDate(item.due)}` : null,
        item.sourceMessage?.timestamp
          ? `source ${formatDateTime(item.sourceMessage.timestamp)}`
          : null,
      ].filter(Boolean);

      lines.push(
        `- ${item.summary}${metaParts.length > 0 ? ` (${metaParts.join(" • ")})` : ""}`,
      );

      if (item.details) {
        lines.push(`  Details: ${item.details}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}
