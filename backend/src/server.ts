import "dotenv/config";
import express from "express";
import cors from "cors";
// x402 imports kept for reference but paywall removed from backend
// import { paymentMiddleware, x402ResourceServer } from "@x402/express";
// import { ExactEvmScheme } from "@x402/evm/exact/server";
// import { HTTPFacilitatorClient } from "@x402/core/server";
import { FileverseClient } from "./fileverse-client.js";
import { generateDisclosure, verifyDisclosure, buildTree } from "./proof-service.js";
import { verifyAgentENS, encodeErc7930, buildAgentTextRecordKey } from "./ens-verifier.js";
import { resolveIdentity, forwardResolve, reverseResolve } from "./ens-resolver.js";
import { createGrant, checkDocumentAccess, getAllGrantsForDocument } from "./access-store.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// x402 paywall removed from backend — the marketplace already collects
// payment from the buyer.  The backend's /disclose is only called by the
// marketplace server (trusted), not by end users directly.

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

// ─── ENS / ENSIP-25 / Access Control Endpoints ─────────────────────

/**
 * POST /verify-agent
 * Body: { ensName, registryAddress, registryChainId, agentId, ensChainId? }
 *
 * Verifies that an ENS name has an ENSIP-25 text record attesting an agent.
 */
app.post("/verify-agent", async (req, res) => {
  try {
    const { ensName, registryAddress, registryChainId, agentId, ensChainId } = req.body;

    if (!ensName || !registryAddress || registryChainId == null || !agentId) {
      res.status(400).json({
        error: "Required: ensName, registryAddress, registryChainId, agentId",
      });
      return;
    }

    const result = await verifyAgentENS({
      ensName,
      registryAddress,
      registryChainId: Number(registryChainId),
      agentId: String(agentId),
      ensChainId: ensChainId ? Number(ensChainId) : 1,
    });

    // Include encoding helpers in response for debugging
    const erc7930 = encodeErc7930(registryAddress, Number(registryChainId));
    const textRecordKey = buildAgentTextRecordKey(
      registryAddress,
      Number(registryChainId),
      String(agentId)
    );

    res.json({ ...result, erc7930Encoding: erc7930, textRecordKey });
  } catch (err: any) {
    console.error("verify-agent error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /resolve-ens
 * Body: { address, chainId? }
 *
 * Resolves wallet address → ENS identity (reverse + forward verification).
 */
app.post("/resolve-ens", async (req, res) => {
  try {
    const { address, chainId } = req.body;
    if (!address) {
      res.status(400).json({ error: "address is required" });
      return;
    }

    const identity = await resolveIdentity(address, chainId ? Number(chainId) : 1);
    res.json(identity);
  } catch (err: any) {
    console.error("resolve-ens error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /grant-access
 * Body: { documentId, sectionIndex, grantType, grantedTo, purchasedBy, requireEnsip25? }
 *
 * Creates an access grant (individual or namespace).
 */
app.post("/grant-access", async (req, res) => {
  try {
    const { documentId, sectionIndex, grantType, grantedTo, purchasedBy, requireEnsip25 } =
      req.body;

    if (!documentId || sectionIndex == null || !grantType || !grantedTo || !purchasedBy) {
      res.status(400).json({
        error: "Required: documentId, sectionIndex, grantType, grantedTo, purchasedBy",
      });
      return;
    }

    const grant = createGrant({
      documentId,
      sectionIndex: Number(sectionIndex),
      grantType,
      grantedTo,
      purchasedBy,
      requireEnsip25: requireEnsip25 ?? false,
    });

    console.log(
      `[grant] ${grantType} grant created: ${grantedTo} → doc:${documentId} section:${sectionIndex}`
    );
    res.json(grant);
  } catch (err: any) {
    console.error("grant-access error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /check-access
 * Body: { address, ensName, documentId, sectionIndex, registryAddress?, registryChainId?, ensChainId? }
 *
 * Checks if a wallet/ENS name has access to a document section.
 */
app.post("/check-access", async (req, res) => {
  try {
    const {
      address,
      ensName,
      documentId,
      sectionIndex,
      registryAddress,
      registryChainId,
      ensChainId,
    } = req.body;

    if (!ensName || !documentId || sectionIndex == null) {
      res.status(400).json({
        error: "Required: ensName, documentId, sectionIndex",
      });
      return;
    }

    const result = await checkDocumentAccess({
      address: address || "",
      documentId,
      sectionIndex: Number(sectionIndex),
      ensName,
      registryAddress,
      registryChainId: registryChainId ? Number(registryChainId) : undefined,
      ensChainId: ensChainId ? Number(ensChainId) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    console.error("check-access error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /grants/:docId
 * Returns all access grants for a document.
 */
app.get("/grants/:docId", (req, res) => {
  const grants = getAllGrantsForDocument(req.params.docId);
  res.json({ documentId: req.params.docId, grants });
});

app.listen(PORT, () => {
  console.log(`DisseK Host Backend running on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /disclose           - Selective disclosure (called by marketplace)");
  console.log("  POST /disclose-direct    - Direct disclosure (no Fileverse)");
  console.log("  POST /verify             - Verify a disclosure proof (FREE)");
  console.log("  POST /build-tree         - Build Merkle tree for a doc (FREE)");
  console.log("  POST /verify-agent       - ENSIP-25 agent verification");
  console.log("  POST /resolve-ens        - ENS identity resolution");
  console.log("  POST /grant-access       - Create access grant");
  console.log("  POST /check-access       - Check document access");
  console.log("  GET  /grants/:docId      - List grants for document");
  console.log("  GET  /documents          - List Fileverse documents (FREE)");
  console.log("  GET  /documents/:ddocId  - Get document with content (FREE)");
  console.log("  GET  /health             - Health check (FREE)");
});
