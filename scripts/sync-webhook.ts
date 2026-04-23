import { LINQ_SUBSCRIBED_EVENTS, LINQ_WEBHOOK_VERSION } from "../lib/constants";
import { getLinqAdminEnv } from "../lib/env";

function getTargetUrl() {
  const env = getLinqAdminEnv();
  const url = new URL("/api/linq/webhook", env.BASE_URL);
  url.searchParams.set("version", LINQ_WEBHOOK_VERSION);
  return url.toString();
}

async function linqRequest(path: string, init: RequestInit) {
  const env = getLinqAdminEnv();
  const response = await fetch(
    `https://api.linqapp.com/api/partner/v3${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${env.LINQ_API_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Linq request failed (${response.status}): ${await response.text()}`,
    );
  }

  return response.json();
}

async function main() {
  const env = getLinqAdminEnv();
  const body = {
    target_url: getTargetUrl(),
    subscribed_events: [...LINQ_SUBSCRIBED_EVENTS],
    phone_numbers: [env.LINQ_PHONE_NUMBER],
  };

  if (env.LINQ_WEBHOOK_SUBSCRIPTION_ID) {
    const updated = await linqRequest(
      `/webhook-subscriptions/${env.LINQ_WEBHOOK_SUBSCRIPTION_ID}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );

    console.log("Updated webhook subscription:");
    console.log(JSON.stringify(updated, null, 2));
    return;
  }

  const created = await linqRequest("/webhook-subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log("Created webhook subscription:");
  console.log(JSON.stringify(created, null, 2));
  console.log(
    "\nStore the returned signing_secret as LINQ_WEBHOOK_SECRET; Linq only returns it on creation.",
  );
}

main().catch((error) => {
  console.error("Webhook sync failed.", error);
  process.exitCode = 1;
});
