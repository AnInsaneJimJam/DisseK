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
app.post("/api/hosts", (req, res) => {
  const { name, backendUrl, description, trustModel, institution } = req.body;

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
    registeredAt: new Date().toISOString(),
  };

  store.addHost(host);
  console.log(`Host registered: ${host.name} (${host.id}) → ${host.backendUrl}`);
  res.status(201).json(host);
});

/**
 * GET /api/hosts
 */
app.get("/api/hosts", (_req, res) => {
  res.json(store.getAllHosts());
});

/**
 * GET /api/hosts/:id
 */
app.get("/api/hosts/:id", (req, res) => {
  const host = store.getHost(req.params.id);
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
app.post("/api/documents", (req, res) => {
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
  } = req.body;

  if (!hostId || !title || !merkleRoot || !sections?.length) {
    res.status(400).json({
      error: "Required: hostId, title, merkleRoot, sections (non-empty)",
    });
    return;
  }

  const host = store.getHost(hostId);
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
    createdAt: new Date().toISOString(),
  };

  store.addDocument(doc);
  console.log(`Document listed: "${doc.title}" (${doc.id}) by host ${host.name}`);
  res.status(201).json(doc);
});

/**
 * GET /api/documents
 * Query: ?q=search&tag=DeFi
 */
app.get("/api/documents", (req, res) => {
  const q = (req.query.q as string) || "";
  const tag = (req.query.tag as string) || undefined;
  const docs = store.searchDocuments(q, tag);

  // Enrich with host info
  const enriched = docs.map((doc) => {
    const host = store.getHost(doc.hostId);
    return {
      ...doc,
      host: host
        ? {
            id: host.id,
            name: host.name,
            trustModel: host.trustModel,
            institution: host.institution,
            reputation: host.reputation,
          }
        : null,
    };
  });

  res.json({ documents: enriched, total: enriched.length });
});

/**
 * GET /api/documents/:id
 */
app.get("/api/documents/:id", (req, res) => {
  const doc = store.getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const host = store.getHost(doc.hostId);
  res.json({
    ...doc,
    host: host
      ? {
          id: host.id,
          name: host.name,
          trustModel: host.trustModel,
          institution: host.institution,
          reputation: host.reputation,
        }
      : null,
  });
});

// ─── Purchase Flow ───────────────────────────────────────────────────

/**
 * POST /api/documents/:id/purchase
 * Body: { sectionId, buyerAddress }
 *
 * 1. Validate the section exists and calculate cost
 * 2. (In production: verify on-chain payment)
 * 3. Forward disclosure request to the host's backend
 * 4. Return disclosed lines + proof package to the buyer
 *
 * The marketplace NEVER sees the original document.
 * It only relays the disclosure request to the host.
 */
app.post("/api/documents/:id/purchase", async (req, res) => {
  try {
    const { sectionId, buyerAddress } = req.body;
    const doc = store.getDocument(req.params.id);

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const section = doc.sections.find((s) => s.id === sectionId);
    if (!section) {
      res.status(404).json({ error: "Section not found" });
      return;
    }

    if (!buyerAddress) {
      res.status(400).json({ error: "buyerAddress required" });
      return;
    }

    const lineCount = section.lineEnd - section.lineStart + 1;
    const totalCost = lineCount * section.pricePerLine;

    // Create purchase record
    const purchase: Purchase = {
      id: uuidv4(),
      documentId: doc.id,
      sectionId: section.id,
      buyerAddress,
      lineStart: section.lineStart,
      lineEnd: section.lineEnd,
      totalCost,
      disclosedLines: [],
      proofPackage: null,
      status: "pending",
      purchasedAt: new Date().toISOString(),
      fulfilledAt: null,
    };
    store.addPurchase(purchase);

    console.log(
      `Purchase ${purchase.id}: buyer ${buyerAddress} → "${doc.title}" lines ${section.lineStart}-${section.lineEnd} ($${totalCost})`
    );

    // Forward to host backend
    const host = store.getHost(doc.hostId);
    if (!host) {
      store.updatePurchase(purchase.id, { status: "failed" });
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
        startLine: section.lineStart,
        endLine: section.lineEnd,
      }),
    });

    if (!hostResponse.ok) {
      const err = await hostResponse.text();
      console.error(`Host disclosure failed: ${err}`);
      store.updatePurchase(purchase.id, { status: "failed" });
      res.status(502).json({ error: "Host failed to generate disclosure" });
      return;
    }

    const hostData = await hostResponse.json();

    // Update purchase with disclosure data
    store.updatePurchase(purchase.id, {
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
      sectionName: section.name,
      lineStart: section.lineStart,
      lineEnd: section.lineEnd,
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
app.get("/api/purchases/:id", (req, res) => {
  const purchase = store.getPurchase(req.params.id);
  if (!purchase) {
    res.status(404).json({ error: "Purchase not found" });
    return;
  }
  res.json(purchase);
});

/**
 * GET /api/purchases?buyer=0x...
 */
app.get("/api/purchases", (req, res) => {
  const buyer = req.query.buyer as string;
  if (!buyer) {
    res.status(400).json({ error: "buyer query param required" });
    return;
  }
  res.json(store.getPurchasesByBuyer(buyer));
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
      const doc = store.getDocument(documentId);
      if (doc) {
        const host = store.getHost(doc.hostId);
        if (host) hostUrl = host.backendUrl;
      }
    }

    // Fallback: use first registered host
    if (!hostUrl) {
      const hosts = store.getAllHosts();
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

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    engine: "DisseK Marketplace",
    hosts: store.getAllHosts().length,
    documents: store.getAllDocuments().length,
  });
});

// ─── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`DisseK Marketplace running on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /api/hosts              - Register a host");
  console.log("  GET  /api/hosts              - List hosts");
  console.log("  POST /api/documents          - List a document");
  console.log("  GET  /api/documents          - Browse documents");
  console.log("  GET  /api/documents/:id      - Document detail");
  console.log("  POST /api/documents/:id/purchase - Purchase a section");
  console.log("  POST /api/verify             - Verify a proof");
  console.log("  GET  /api/health             - Health check");
});
