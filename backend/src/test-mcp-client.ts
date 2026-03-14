/**
 * Quick test to verify the FileverseClient connects via MCP protocol
 * and can list/get documents.
 * Usage: npx tsx src/test-mcp-client.ts
 */

import "dotenv/config";
import { FileverseClient } from "./fileverse-client.js";

async function main() {
  console.log("=== FileverseClient MCP Test ===\n");
  console.log(`MCP URL: ${process.env.FILEVERSE_API_URL}\n`);

  const client = new FileverseClient();

  // Test 1: List documents
  console.log("--- listDocuments ---");
  const list = await client.listDocuments(5);
  console.log(`Found ${list.total} document(s)`);
  for (const doc of list.ddocs) {
    console.log(`  [${doc.ddocId}] ${doc.title} (${doc.syncStatus})`);
  }

  // Test 2: Get a specific document
  if (list.ddocs.length > 0) {
    const ddocId = list.ddocs[0]!.ddocId;
    console.log(`\n--- getDocument(${ddocId}) ---`);
    const doc = await client.getDocument(ddocId);
    console.log(`  Title: ${doc.title}`);
    console.log(`  Content length: ${doc.content.length} chars`);
    console.log(`  Lines: ${doc.content.split("\n").length}`);
    console.log(`  Sync: ${doc.syncStatus}`);
  }

  await client.disconnect();
  console.log("\nMCP client test passed!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
