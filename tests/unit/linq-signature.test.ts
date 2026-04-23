import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLinqWebhookSignature } from "@/lib/linq";

describe("verifyLinqWebhookSignature", () => {
  it("accepts a valid signature", () => {
    const body = JSON.stringify({ hello: "world" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secret = "whsec_test";
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(
      verifyLinqWebhookSignature({
        bodyText: body,
        timestamp,
        signature,
        secret,
      }),
    ).toBe(true);
  });

  it("rejects stale timestamps", () => {
    const body = JSON.stringify({ hello: "world" });
    const secret = "whsec_test";
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(
      verifyLinqWebhookSignature({
        bodyText: body,
        timestamp,
        signature,
        secret,
      }),
    ).toBe(false);
  });
});
