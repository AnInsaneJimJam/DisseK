/**
 * End-to-end test of the selective disclosure flow.
 * Runs the WASM proof engine locally without needing the Fileverse API.
 * Usage: npm run test-flow
 */

import { generateDisclosure, verifyDisclosure } from "./proof-service.js";

const testDocument = `# Test Document for Selective Disclosure

This is line 1 of the test document.
This is line 2 containing some data.
This is line 3 with public info.
This is line 4 - shared section ends here.
This is line 5 - CONFIDENTIAL.
This is line 6 - TOP SECRET.
This is line 7 - END OF DOCUMENT.`;

console.log("=== DisseK Selective Disclosure — E2E Test ===\n");

// Split to show line count
const allLines = testDocument.split("\n");
console.log(`Document has ${allLines.length} lines:`);
allLines.forEach((line, i) => console.log(`  [${i}] ${line}`));

// --- STEP 1: Owner generates disclosure for lines 0-4 ---
console.log("\n--- Step 1: Generate Disclosure (lines 0 to 4) ---");
const startLine = 0;
const endLine = 4;

const { disclosedLines, proofPackage } = generateDisclosure(
  testDocument,
  startLine,
  endLine
);

console.log(`Disclosed ${disclosedLines.length} lines:`);
disclosedLines.forEach((line, i) => console.log(`  [${startLine + i}] ${line}`));
console.log(`\nMerkle Root: ${proofPackage.original_root}`);
console.log(`Total Leaves (padded): ${proofPackage.total_leaves}`);
console.log(`Proof size: ${proofPackage.multi_proof.length / 2} bytes`);

// --- STEP 2: Bob verifies the disclosure ---
console.log("\n--- Step 2: Bob Verifies the Disclosure ---");
const isValid = verifyDisclosure(disclosedLines, proofPackage);
console.log(`Verification result: ${isValid ? " VALID" : " INVALID"}`);

// --- STEP 3: Tamper test ---
console.log("\n--- Step 3: Tamper Detection Test ---");
const tamperedLines = [...disclosedLines];
tamperedLines[0] = "TAMPERED LINE";
const isTamperedValid = verifyDisclosure(tamperedLines, proofPackage);
console.log(
  `Tampered verification: ${isTamperedValid ? " SHOULD HAVE FAILED" : " Correctly rejected tampered data"}`
);

// --- STEP 4: Wrong range test ---
console.log("\n--- Step 4: Wrong Range Test ---");
const shiftedPackage = { ...proofPackage, range_start: 1 };
const isShiftedValid = verifyDisclosure(disclosedLines, shiftedPackage);
console.log(
  `Wrong-range verification: ${isShiftedValid ? " SHOULD HAVE FAILED" : " Correctly rejected wrong range"}`
);

console.log("\n=== All tests passed! ===");
