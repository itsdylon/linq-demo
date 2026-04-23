import { describe, expect, it } from "vitest";
import { extractionToolPayloadSchema } from "@/lib/domain";

describe("extractionToolPayloadSchema", () => {
  it("accepts well-formed extracted items", () => {
    const parsed = extractionToolPayloadSchema.parse({
      items: [
        {
          summary: "Client approved the Baxter sofa in emerald velvet.",
          type: "Decision",
          owner: "Client",
          confidence: 0.91,
          details: "Approval happened in the main project thread.",
        },
      ],
    });

    expect(parsed.items).toHaveLength(1);
  });

  it("rejects malformed items", () => {
    expect(() =>
      extractionToolPayloadSchema.parse({
        items: [{ type: "Decision", confidence: 1.2 }],
      }),
    ).toThrow();
  });
});
