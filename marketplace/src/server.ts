import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { store } from "./store.js";
import type {
  Host,
  DocumentListing,
  SectionListing,
  Purchase,
} from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.MARKETPLACE_PORT || 3002;

// ─── Host Registration ───────────────────────────────────────────────

/**
 * POST /api/hosts
 * Body: { name, backendUrl, description, trustModel, institution? }
 *
 * A document owner registers their host backend so the marketplace
 * can forward purchase requests to it.
 */
app.post("/api/hosts", async (req, res) => {
  const { name, backendUrl, description, trustModel, institution, signerAddress, ensName } = req.body;

  if (!name || !backendUrl || !trustModel) {
    res
      .status(400)
      .json({ error: "Required: name, backendUrl, trustModel" });
    return;
  }

  const host: Host = {
    id: uuidv4(),
    name,
    backendUrl,
    description: description || "",
    trustModel,
    institution: institution || undefined,
    reputation: trustModel === "institution" ? 90 : 50,
    signerAddress: signerAddress || undefined,
    ensName: ensName || undefined,
    registeredAt: new Date().toISOString(),
  };

  await store.addHost(host);
  console.log(`Host registered: ${host.name} (${host.id}) → ${host.backendUrl}`);
  res.status(201).json(host);
});

/**
 * GET /api/hosts
 */
app.get("/api/hosts", async (_req, res) => {
  res.json(await store.getAllHosts());
});

/**
 * GET /api/hosts/:id
 */
app.get("/api/hosts/:id", async (req, res) => {
  const host = await store.getHost(req.params.id);
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }
  res.json(host);
});

// ─── Document Listings ───────────────────────────────────────────────

/**
 * POST /api/documents
 * Body: { hostId, ddocId, title, description, tags, totalLines,
 *         merkleRoot, anchorTx, anchorChain, sections }
 *
 * Host lists a document on the marketplace. The marketplace never sees
 * the actual document content — only metadata, section definitions,
 * and the on-chain Merkle root.
 */
app.post("/api/documents", async (req, res) => {
  const {
    hostId,
    ddocId,
    title,
    description,
    tags,
    totalLines,
    merkleRoot,
    anchorTx,
    anchorChain,
    sections,
    sellLineByLine,
    pricePerLine,
  } = req.body;

  if (!hostId || !title || !merkleRoot) {
    res.status(400).json({
      error: "Required: hostId, title, merkleRoot",
    });
    return;
  }

  const host = await store.getHost(hostId);
  if (!host) {
    res.status(404).json({ error: "Host not found. Register first." });
    return;
  }

  const sectionListings: SectionListing[] = sections.map(
    (s: any, idx: number) => ({
      id: uuidv4(),
      name: s.name || `Section ${idx + 1}`,
      lineStart: s.lineStart,
      lineEnd: s.lineEnd,
      pricePerLine: s.pricePerLine ?? 0,
      description: s.description || "",
    })
  );

  const doc: DocumentListing = {
    id: uuidv4(),
    hostId,
    ddocId: ddocId || "",
    title,
    description: description || "",
    tags: tags || [],
    totalLines: totalLines || 0,
    merkleRoot,
    anchorTx: anchorTx || "",
    anchorChain: anchorChain || "sepolia",
    sections: sectionListings,
    sellLineByLine: sellLineByLine ?? false,
    pricePerLine: pricePerLine ?? 0,
    createdAt: new Date().toISOString(),
  };

  await store.addDocument(doc);
  console.log(`Document listed: "${doc.title}" (${doc.id}) by host ${host.name}`);
  res.status(201).json(doc);
});

/**
 * GET /api/documents
 * Query: ?q=search&tag=DeFi
 */
app.get("/api/documents", async (req, res) => {
  const q = (req.query.q as string) || "";
  const tag = (req.query.tag as string) || undefined;
  const docs = await store.searchDocuments(q, tag);

  // Enrich with host info
  const enriched = await Promise.all(docs.map(async (doc) => {
    const host = await store.getHost(doc.hostId);
    return {
      ...doc,
      host: host
        ? {
          id: host.id,
          name: host.name,
          trustModel: host.trustModel,
          institution: host.institution,
          reputation: host.reputation,
          signerAddress: host.signerAddress,
          ensName: host.ensName,
        }
        : null,
    };
  }));

  res.json({ documents: enriched, total: enriched.length });
});

/**
 * GET /api/documents/:id
 */
app.get("/api/documents/:id", async (req, res) => {
  const doc = await store.getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const host = await store.getHost(doc.hostId);
  res.json({
    ...doc,
    host: host
      ? {
        id: host.id,
        name: host.name,
        trustModel: host.trustModel,
        institution: host.institution,
        reputation: host.reputation,
        signerAddress: host.signerAddress,
        ensName: host.ensName,
      }
      : null,
  });
});

// ─── Purchase Flow ───────────────────────────────────────────────────

/**
 * POST /api/documents/:id/purchase
 * Body: { sectionId?, lineStart?, lineEnd?, buyerAddress }
 *
 * Two modes:
 *   a) sectionId provided → use predefined section ranges
 *   b) lineStart + lineEnd provided → line-by-line purchase (requires sellLineByLine)
 *
 * The marketplace NEVER sees the original document.
 * It only relays the disclosure request to the host.
 */
app.post("/api/documents/:id/purchase", async (req: express.Request<{ id: string }>, res) => {
  try {
    const { sectionId, lineStart: reqLineStart, lineEnd: reqLineEnd, buyerAddress, paymentTx } = req.body;
    const doc = await store.getDocument(req.params.id);

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (!buyerAddress) {
      res.status(400).json({ error: "buyerAddress is required" });
      return;
    }

    let lineStart: number;
    let lineEnd: number;
    let costPerLine: number;
    let sectionName: string;
    let resolvedSectionId: string;

    if (sectionId) {
      // Mode A: section-based purchase
      const section = doc.sections.find((s) => s.id === sectionId);
      if (!section) {
        res.status(404).json({ error: `Section "${sectionId}" not found in this document` });
        return;
      }
      lineStart = section.lineStart;
      lineEnd = section.lineEnd;
      costPerLine = section.pricePerLine;
      sectionName = section.name;
      resolvedSectionId = sectionId;
    } else if (reqLineStart !== undefined && reqLineEnd !== undefined) {
      // Mode B: line-by-line purchase
      if (!doc.sellLineByLine) {
        res.status(400).json({ error: "This document does not support line-by-line purchases" });
        return;
      }
      lineStart = reqLineStart;
      lineEnd = reqLineEnd;
      if (lineStart < 0 || lineEnd >= doc.totalLines || lineStart > lineEnd) {
        res.status(400).json({ error: `Invalid line range. Document has ${doc.totalLines} lines (0-${doc.totalLines - 1})` });
        return;
      }
      costPerLine = doc.pricePerLine;
      sectionName = `Lines ${lineStart}–${lineEnd}`;
      resolvedSectionId = `custom-${lineStart}-${lineEnd}`;
    } else {
      res.status(400).json({ error: "Provide either sectionId or lineStart+lineEnd" });
      return;
    }

    const lineCount = lineEnd - lineStart + 1;
    const totalCost = lineCount * costPerLine;

    // Create purchase record
    const purchase: Purchase = {
      id: uuidv4(),
      documentId: doc.id,
      sectionId: resolvedSectionId,
      buyerAddress,
      lineStart,
      lineEnd,
      totalCost,
      paymentTx: paymentTx || null,
      disclosedLines: [],
      proofPackage: null,
      status: "pending",
      purchasedAt: new Date().toISOString(),
      fulfilledAt: null,
    };
    await store.addPurchase(purchase);

    console.log(
      `Purchase ${purchase.id}: buyer ${buyerAddress} → "${doc.title}" lines ${lineStart}-${lineEnd} ($${totalCost})`
    );

    // Forward to host backend
    const host = await store.getHost(doc.hostId);
    if (!host) {
      await store.updatePurchase(purchase.id, { status: "failed" });
      res.status(500).json({ error: "Host not found for this document" });
      return;
    }

    console.log(
      `Forwarding disclosure request to host ${host.name} at ${host.backendUrl}...`
    );

    const hostResponse = await fetch(`${host.backendUrl}/disclose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ddocId: doc.ddocId,
        startLine: lineStart,
        endLine: lineEnd,
      }),
    });

    if (!hostResponse.ok) {
      const err = await hostResponse.text();
      console.error(`Host disclosure failed: ${err}`);
      await store.updatePurchase(purchase.id, { status: "failed" });
      res.status(502).json({ error: "Host failed to generate disclosure" });
      return;
    }

    const hostData = await hostResponse.json();

    // Update purchase with disclosure data
    await store.updatePurchase(purchase.id, {
      status: "fulfilled",
      disclosedLines: hostData.disclosedLines || [],
      proofPackage: hostData.proofPackage || null,
      fulfilledAt: new Date().toISOString(),
    });

    console.log(`Purchase ${purchase.id} fulfilled.`);

    res.json({
      success: true,
      purchaseId: purchase.id,
      documentTitle: doc.title,
      sectionName,
      lineStart,
      lineEnd,
      totalCost,
      disclosureDocId: hostData.disclosureDocId || null,
      disclosureLink: hostData.disclosureLink || null,
      disclosedLines: hostData.disclosedLines || [],
      linesDisclosed: hostData.linesDisclosed,
      proofPackage: hostData.proofPackage,
      merkleRoot: doc.merkleRoot,
      anchorTx: doc.anchorTx,
      anchorChain: doc.anchorChain,
    });
  } catch (err: any) {
    console.error("Purchase error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/purchases/:id
 */
app.get("/api/purchases/:id", async (req, res) => {
  const purchase = await store.getPurchase(req.params.id);
  if (!purchase) {
    res.status(404).json({ error: "Purchase not found" });
    return;
  }
  res.json(purchase);
});

/**
 * GET /api/purchases?buyer=0x...
 */
app.get("/api/purchases", async (req, res) => {
  const buyer = req.query.buyer as string;
  if (!buyer) {
    res.status(400).json({ error: "buyer query param required" });
    return;
  }
  res.json(await store.getPurchasesByBuyer(buyer));
});

// ─── Verification (convenience proxy) ────────────────────────────────

/**
 * POST /api/verify
 * Body: { disclosedLines, proofPackage }
 *
 * Proxies to any host's /verify endpoint, or can be done client-side.
 * This exists so the buyer doesn't need to know the host URL.
 */
app.post("/api/verify", async (req, res) => {
  try {
    const { disclosedLines, proofPackage, documentId } = req.body;

    if (!disclosedLines || !proofPackage) {
      res
        .status(400)
        .json({ error: "Required: disclosedLines, proofPackage" });
      return;
    }

    // Find any host to proxy verification to
    let hostUrl: string | null = null;

    if (documentId) {
      const doc = await store.getDocument(documentId);
      if (doc) {
        const host = await store.getHost(doc.hostId);
        if (host) hostUrl = host.backendUrl;
      }
    }

    // Fallback: use first registered host
    if (!hostUrl) {
      const hosts = await store.getAllHosts();
      if (hosts.length > 0) hostUrl = hosts[0]!.backendUrl;
    }

    if (!hostUrl) {
      res
        .status(503)
        .json({ error: "No host available for verification" });
      return;
    }

    const verifyResponse = await fetch(`${hostUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disclosedLines, proofPackage }),
    });

    const result = await verifyResponse.json();
    res.json(result);
  } catch (err: any) {
    console.error("Verify proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health ──────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  const hosts = await store.getAllHosts();
  const documents = await store.getAllDocuments();
  res.json({
    status: "ok",
    engine: "DisseK Marketplace",
    hosts: hosts.length,
    documents: documents.length,
  });
});

// ─── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`DisseK Marketplace running on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /api/hosts                   - Register a host (FREE)");
  console.log("  GET  /api/hosts                   - List hosts (FREE)");
  console.log("  POST /api/documents               - List a document (FREE)");
  console.log("  GET  /api/documents               - Browse documents (FREE)");
  console.log("  GET  /api/documents/:id           - Document detail (FREE)");
  console.log("  POST /api/documents/:id/purchase  - Purchase section");
  console.log("  POST /api/verify                  - Verify a proof (FREE)");
  console.log("  GET  /api/health                  - Health check (FREE)");
});
