import "dotenv/config";
import express from "express";
import { FileverseClient } from "./fileverse-client.js";
import { generateDisclosure, verifyDisclosure } from "./proof-service.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Shared singleton — stays connected across requests
let _fvClient: FileverseClient | null = null;
function getFileverseClient(): FileverseClient {
  if (!_fvClient) {
    _fvClient = new FileverseClient();
  }
  return _fvClient;
}

/**
 * POST /disclose
 * Body: { ddocId: string, startLine: number, endLine: number }
 *
 * 1. Fetches the original doc from Fileverse
 * 2. Generates a Merkle proof for the selected line range
 * 3. Creates a new partial doc on Fileverse with the disclosed content
 * 4. Returns the new doc link + proof package
 */
app.post("/disclose", async (req, res) => {
  try {
    const { ddocId, startLine, endLine } = req.body;

    if (!ddocId || startLine == null || endLine == null) {
      res.status(400).json({
        error: "Required fields: ddocId, startLine, endLine",
      });
      return;
    }

    const client = getFileverseClient();

    // 1. Fetch the original document
    console.log(`[1/4] Fetching document ${ddocId} from Fileverse...`);
    const originalDoc = await client.getDocument(ddocId);

    if (!originalDoc.content) {
      res.status(404).json({ error: "Document has no content" });
      return;
    }

    // 2. Generate the Merkle proof for the selected range
    console.log(
      `[2/4] Generating Merkle proof for lines ${startLine}-${endLine}...`
    );
    const { disclosedLines, proofPackage } = generateDisclosure(
      originalDoc.content,
      startLine,
      endLine
    );

    // 3. Build the partial document content (disclosed lines + proof metadata)
    const partialContent = [
      `# Selective Disclosure: ${originalDoc.title}`,
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

    // 4. Create the new partial document on Fileverse
    console.log(`[3/4] Creating partial disclosure document on Fileverse...`);
    const newDoc = await client.createDocument(
      `[Disclosure] ${originalDoc.title} (lines ${startLine}-${endLine})`,
      partialContent
    );

    console.log(
      `[4/4] Done! New doc created: ${newDoc.ddocId} (sync: ${newDoc.syncStatus})`
    );

    res.json({
      success: true,
      originalDocId: ddocId,
      disclosureDocId: newDoc.ddocId,
      disclosureLink: newDoc.link,
      syncStatus: newDoc.syncStatus,
      linesDisclosed: disclosedLines.length,
      proofPackage,
    });
  } catch (err: any) {
    console.error("Disclosure error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /disclose-direct
 * Body: { content: string, startLine: number, endLine: number, title?: string }
 *
 * Like /disclose but accepts document content directly (no Fileverse fetch).
 * Returns the disclosed lines, proof package, and the markdown for a new doc.
 */
app.post("/disclose-direct", async (req, res) => {
  try {
    const { content, startLine, endLine, title } = req.body;

    if (!content || startLine == null || endLine == null) {
      res.status(400).json({
        error: "Required fields: content, startLine, endLine",
      });
      return;
    }

    const { disclosedLines, proofPackage } = generateDisclosure(
      content,
      startLine,
      endLine
    );

    const docTitle = title || "Untitled Document";
    const partialContent = [
      `# Selective Disclosure: ${docTitle}`,
      "",
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

    res.json({
      success: true,
      linesDisclosed: disclosedLines.length,
      disclosedLines,
      proofPackage,
      partialDocumentMarkdown: partialContent,
    });
  } catch (err: any) {
    console.error("Direct disclosure error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /verify
 * Body: { disclosedLines: string[], proofPackage: ProofPackage }
 *
 * Verifies that the disclosed lines match the original Merkle root.
 */
app.post("/verify", async (req, res) => {
  try {
    const { disclosedLines, proofPackage } = req.body;

    if (!disclosedLines || !proofPackage) {
      res.status(400).json({
        error: "Required fields: disclosedLines, proofPackage",
      });
      return;
    }

    const isValid = verifyDisclosure(disclosedLines, proofPackage);

    res.json({
      verified: isValid,
      message: isValid
        ? "The disclosed lines are cryptographically proven to be part of the original document."
        : "Verification FAILED. The lines do not match the original document root.",
    });
  } catch (err: any) {
    console.error("Verification error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /health
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", engine: "DisseK Selective Disclosure Backend" });
});

app.listen(PORT, () => {
  console.log(`DisseK backend running on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /disclose  - Generate selective disclosure");
  console.log("  POST /verify    - Verify a disclosure proof");
  console.log("  GET  /health    - Health check");
});
