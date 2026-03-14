/**
 * Marketplace API client.
 * All calls go through the Vite proxy:
 *   /api/*      → marketplace backend (port 3002)
 *   /host-api/* → host backend (port 3001)
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface Host {
  id: string;
  name: string;
  backendUrl: string;
  description: string;
  trustModel: "reputation" | "institution";
  institution?: string;
  reputation: number;
  signerAddress?: string;
  ensName?: string;
  registeredAt: string;
}

export interface SectionListing {
  id: string;
  name: string;
  lineStart: number;
  lineEnd: number;
  pricePerLine: number;
  description: string;
}

export interface DocumentListing {
  id: string;
  hostId: string;
  ddocId: string;
  title: string;
  description: string;
  tags: string[];
  totalLines: number;
  merkleRoot: string;
  anchorTx: string;
  anchorChain: string;
  sections: SectionListing[];
  sellLineByLine: boolean;
  pricePerLine: number;
  createdAt: string;
  host: {
    id: string;
    name: string;
    trustModel: string;
    institution?: string;
    reputation: number;
    signerAddress?: string;
    ensName?: string;
  } | null;
}

export interface ProofPackage {
  original_root: string;
  total_leaves: number;
  range_start: number;
  range_end: number;
  salts: string[];
  multi_proof: string;
}

export interface PurchaseResult {
  success: boolean;
  purchaseId: string;
  documentTitle: string;
  sectionName: string;
  lineStart: number;
  lineEnd: number;
  totalCost: number;
  disclosureDocId: string | null;
  disclosureLink: string | null;
  disclosedLines: string[];
  linesDisclosed: number;
  proofPackage: ProofPackage;
  merkleRoot: string;
  anchorTx: string;
  anchorChain: string;
}

export interface VerifyResult {
  verified: boolean;
  message: string;
}

// ─── API Calls ───────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Hosts ---

export function registerHost(data: {
  name: string;
  backendUrl: string;
  description: string;
  trustModel: "reputation" | "institution";
  institution?: string;
  signerAddress?: string;
  ensName?: string;
}): Promise<Host> {
  return fetchJson("/api/hosts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function listHosts(): Promise<Host[]> {
  return fetchJson("/api/hosts");
}

// --- Documents ---

export function listDocuments(
  query?: string,
  tag?: string
): Promise<{ documents: DocumentListing[]; total: number }> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (tag && tag !== "All") params.set("tag", tag);
  return fetchJson(`/api/documents?${params}`);
}

export function getDocument(id: string): Promise<DocumentListing> {
  return fetchJson(`/api/documents/${id}`);
}

export function createDocumentListing(data: {
  hostId: string;
  ddocId: string;
  title: string;
  description: string;
  tags: string[];
  totalLines: number;
  merkleRoot: string;
  anchorTx: string;
  anchorChain: string;
  sellLineByLine?: boolean;
  pricePerLine?: number;
  sections: {
    name: string;
    lineStart: number;
    lineEnd: number;
    pricePerLine: number;
    description: string;
  }[];
}): Promise<DocumentListing> {
  return fetchJson("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// --- Purchase ---

export function purchaseLines(
  documentId: string,
  lineStart: number,
  lineEnd: number,
  buyerAddress: string
): Promise<PurchaseResult> {
  return fetchJson(`/api/documents/${documentId}/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lineStart, lineEnd, buyerAddress }),
  });
}


export function purchaseSection(
  documentId: string,
  sectionId: string,
  buyerAddress: string
): Promise<PurchaseResult> {
  return fetchJson(`/api/documents/${documentId}/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionId, buyerAddress }),
  });
}

// --- Verify ---

export function verifyProof(
  disclosedLines: string[],
  proofPackage: ProofPackage,
  documentId?: string
): Promise<VerifyResult> {
  return fetchJson("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disclosedLines, proofPackage, documentId }),
  });
}

// --- Host Backend Calls (for Publish flow) ---

export interface FileverseDoc {
  ddocId: string;
  title: string;
  content: string;
  lineCount: number;
  lines: string[];
  syncStatus: string;
  link: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileverseListResponse {
  ddocs: {
    ddocId: string;
    title: string;
    syncStatus: string;
    link: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  total: number;
  hasNext: boolean;
}

export function checkHostHealth(hostUrl: string): Promise<{ status: string; engine: string }> {
  return fetchJson(`${hostUrl}/health`);
}

export function listHostDocuments(
  hostUrl: string,
  limit = 20,
  skip = 0
): Promise<FileverseListResponse> {
  return fetchJson(`${hostUrl}/documents?limit=${limit}&skip=${skip}`);
}

export function getHostDocument(hostUrl: string, ddocId: string): Promise<FileverseDoc> {
  return fetchJson(`${hostUrl}/documents/${ddocId}`);
}

export function buildMerkleTree(hostUrl: string, ddocId: string): Promise<{
  ddocId: string;
  title: string;
  merkleRoot: string;
  totalLeaves: number;
  lineCount: number;
}> {
  return fetchJson(`${hostUrl}/build-tree`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ddocId }),
  });
}

// --- Health ---

export function checkMarketplaceHealth(): Promise<{
  status: string;
  hosts: number;
  documents: number;
}> {
  return fetchJson("/api/health");
}
