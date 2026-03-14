/**
 * Simulates the full end-to-end flow as if the backend received a request:
 * 1. "Fetch" the document content (passed in as if from Fileverse API)
 * 2. Run the WASM proof engine to generate disclosure
 * 3. Output the new partial document content + proof package
 *    (ready to be created on Fileverse via MCP or API)
 */

import { generateDisclosure, verifyDisclosure } from "./proof-service.js";

// --- This content is what we fetched from Fileverse ddocId: tdJsPVnnZxN6JG2keVhjMN ---
const originalDocContent = `# Test Document for Selective Disclosure

This is line 1 of the test document.
This is line 2 containing some data.
This is line 3 with public info.
This is line 4 - shared section ends here.
This is line 5 - CONFIDENTIAL.
This is line 6 - TOP SECRET.
This is line 7 - END OF DOCUMENT.`;

const ddocId = "tdJsPVnnZxN6JG2keVhjMN";
const startLine = 0;
const endLine = 5; // Disclose lines 0–5, hide 6–8

console.log("=== DisseK Full E2E Flow ===\n");
console.log(`Source document: ${ddocId}`);
console.log(`Disclosing lines: ${startLine} to ${endLine}\n`);

// Step 1: Generate disclosure
const { disclosedLines, proofPackage } = generateDisclosure(
  originalDocContent,
  startLine,
  endLine
);

console.log("--- Disclosed Lines ---");
disclosedLines.forEach((line, i) =>
  console.log(`  [${startLine + i}] ${line}`)
);

console.log("\n--- Proof Package ---");
console.log(JSON.stringify(proofPackage, null, 2));

// Step 2: Verify (Bob's side)
console.log("\n--- Verification ---");
const isValid = verifyDisclosure(disclosedLines, proofPackage);
console.log(`Result: ${isValid ? " VALID" : " INVALID"}`);

// Step 3: Build the markdown content for the new Fileverse doc
const partialContent = [
  `# Selective Disclosure: DisseK Test Document`,
  "",
  `> Verified excerpt from original document \`${ddocId}\``,
  `> Lines ${startLine} to ${endLine} (0-indexed)`,
  "",
  "---",
  "",
  "## Disclosed Content",
  "",
  ...disclosedLines,
  "",
  "---",
  "",
  "## Proof Package",
  "",
  "```json",
  JSON.stringify(proofPackage, null, 2),
  "```",
].join("\n");

console.log("\n--- New Document Content (for Fileverse) ---");
console.log(partialContent);
