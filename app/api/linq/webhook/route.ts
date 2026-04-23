import { after } from "next/server";
import { getAirtableStore } from "@/lib/airtable";
import { getWebhookEnv } from "@/lib/env";
import {
  parseLinqWebhookEnvelope,
  verifyLinqWebhookSignature,
} from "@/lib/linq";
import { processLinqEvent } from "@/lib/processing";

export const runtime = "nodejs";

const store = getAirtableStore();

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get("X-Webhook-Signature");
  const timestamp = request.headers.get("X-Webhook-Timestamp");
  const webhookSecret = getWebhookEnv().LINQ_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Linq webhook received before LINQ_WEBHOOK_SECRET was set.");
    return new Response("Webhook secret not configured", { status: 503 });
  }

  if (
    !verifyLinqWebhookSignature({
      bodyText,
      signature,
      timestamp,
      secret: webhookSecret,
    })
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  let envelope: ReturnType<typeof parseLinqWebhookEnvelope> | null = null;
  try {
    envelope = parseLinqWebhookEnvelope(bodyText);
  } catch (error) {
    console.error("Failed to parse Linq webhook payload", error);
    return new Response(null, { status: 200 });
  }

  const receipt = await store.ensureEventReceipt({
    envelope,
    rawBodyText: bodyText,
  });

  if (!receipt.created) {
    return new Response(null, { status: 200 });
  }

  after(async () => {
    if (!envelope) {
      return;
    }

    try {
      await processLinqEvent(envelope, store);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";
      await store.updateEventStatus(envelope.event_id, {
        status: "Failed",
        processingNotes: message,
      });
      console.error("Failed to process Linq webhook event", {
        eventId: envelope.event_id,
        eventType: envelope.event_type,
        message,
      });
    }
  });

  return new Response(null, { status: 200 });
}
