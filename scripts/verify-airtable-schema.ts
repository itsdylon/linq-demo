import { getAirtableStore } from "../lib/airtable";

async function main() {
  const missing = await getAirtableStore().verifyRequiredSchema();

  if (missing.length === 0) {
    console.log("Airtable schema looks good.");
    return;
  }

  console.error("Airtable schema is missing required tables or fields:");
  for (const entry of missing) {
    console.error(`- ${entry}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Schema verification failed.", error);
  process.exitCode = 1;
});
