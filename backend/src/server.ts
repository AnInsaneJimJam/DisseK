import "dotenv/config";
import express from "express";
import cors from "cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { FileverseClient } from "./fileverse-client.js";
import { generateDisclosure, verifyDisclosure, buildTree } from "./proof-service.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- x402 Payment Configuration ---
const evmPayTo = (process.env.EVM_PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
const x402Network = (process.env.X402_NETWORK || "eip155:84532") as `${string}:${string}`;
const disclosurePrice = process.env.DISCLOSURE_PRICE || "$0.01";

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme())
  .register("eip155:8453", new ExactEvmScheme());

// x402 paywall: only POST /disclose requires payment.
// All other endpoints (browsing, verification, health) remain free.
app.use(
  paymentMiddleware(
    {
      "POST /disclose": {
        accepts: {
          scheme: "exact",
          price: disclosurePrice,
          network: x402Network,
          payTo: evmPayTo,
        },
        description: "Selective disclosure of document lines with Merkle proof",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

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
 * 4. Returns the new doc link + proof package (proof is NOT in the dDoc, only in API response)
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

    // 3. Build the partial document content (clean disclosed lines only — no proof)
    const partialContent = [
      `# Selective Disclosure: ${originalDoc.title}`,
      "",
      `> Verified excerpt from original document \`${ddocId}\``,
      `> Lines ${startLine} to ${endLine} (0-indexed)`,
      "",
      "---",
      "",
      ...disclosedLines,
    ].join("\n");

    // 4. Try to create a new partial document on Fileverse (non-fatal if it fails)
    let disclosureDocId: string | null = null;
    let disclosureLink: string | null = null;
    let syncStatus: string | null = null;
    try {
      console.log(`[3/4] Creating partial disclosure document on Fileverse...`);
      const newDoc = await client.createDocument(
        `[Disclosure] ${originalDoc.title} (lines ${startLine}-${endLine})`,
        partialContent
      );
      disclosureDocId = newDoc.ddocId;
      disclosureLink = newDoc.link;
      syncStatus = newDoc.syncStatus;
      console.log(
        `[4/4] Done! New doc created: ${newDoc.ddocId} (sync: ${newDoc.syncStatus})`
      );
    } catch (fvErr: any) {
      console.warn(
        `[3/4] Fileverse doc creation failed (non-fatal): ${fvErr.message}`
      );
      console.log(`[4/4] Returning proof without Fileverse disclosure doc.`);
    }

    res.json({
      success: true,
      originalDocId: ddocId,
      disclosureDocId,
      disclosureLink,
      syncStatus,
      linesDisclosed: disclosedLines.length,
      disclosedLines,
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
      ...disclosedLines,
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

// ─── Fileverse Document Browsing (for Publish flow) ─────────────────

/**
 * GET /documents
 * Lists documents from the host's Fileverse instance via MCP.
 * Query: ?limit=10&skip=0
 */
app.get("/documents", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = parseInt(req.query.skip as string) || 0;
    const client = getFileverseClient();
    const result = await client.listDocuments(limit, skip);
    res.json(result);
  } catch (err: any) {
    console.error("List documents error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /documents/:ddocId
 * Fetches a single document from Fileverse with its content.
 * Returns the doc metadata plus lineCount for section definition.
 */
app.get("/documents/:ddocId", async (req, res) => {
  try {
    const client = getFileverseClient();
    const doc = await client.getDocument(req.params.ddocId);
    const lines = doc.content ? doc.content.split("\n") : [];
    res.json({
      ddocId: doc.ddocId,
      title: doc.title,
      content: doc.content,
      lineCount: lines.length,
      lines,
      syncStatus: doc.syncStatus,
      link: doc.link,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err: any) {
    console.error("Get document error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /build-tree
 * Body: { ddocId: string }
 *
 * Fetches the document from Fileverse and builds the full Merkle tree.
 * Returns the root hash and tree metadata — no disclosure is generated.
 * Used during the Publish flow to get the root before listing on marketplace.
 */
app.post("/build-tree", async (req, res) => {
  try {
    const { ddocId } = req.body;
    if (!ddocId) {
      res.status(400).json({ error: "ddocId required" });
      return;
    }

    const client = getFileverseClient();
    const doc = await client.getDocument(ddocId);

    if (!doc.content) {
      res.status(404).json({ error: "Document has no content" });
      return;
    }

    const { root, totalLeaves, lineCount } = buildTree(doc.content);

    console.log(
      `Built Merkle tree for ${ddocId}: root=${root.slice(0, 16)}... leaves=${totalLeaves} lines=${lineCount}`
    );

    res.json({
      ddocId,
      title: doc.title,
      merkleRoot: root,
      totalLeaves,
      lineCount,
    });
  } catch (err: any) {
    console.error("Build tree error:", err);
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
  console.log(`DisseK Host Backend running on http://localhost:${PORT}`);
  console.log(`x402 paywall: ${disclosurePrice} on ${x402Network} → ${evmPayTo}`);
  console.log("Endpoints:");
  console.log("  POST /disclose           - Selective disclosure (PAID via x402)");
  console.log("  POST /disclose-direct    - Direct disclosure (FREE, no Fileverse)");
  console.log("  POST /verify             - Verify a disclosure proof (FREE)");
  console.log("  POST /build-tree         - Build Merkle tree for a doc (FREE)");
  console.log("  GET  /documents          - List Fileverse documents (FREE)");
  console.log("  GET  /documents/:ddocId  - Get document with content (FREE)");
  console.log("  GET  /health             - Health check (FREE)");
});
