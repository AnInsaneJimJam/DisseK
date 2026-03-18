export interface Host {
  id: string;
  name: string;
  backendUrl: string; // e.g. http://localhost:3001
  description: string;
  trustModel: "reputation" | "institution";
  institution?: string; // e.g. "Johns Hopkins Hospital", "Delphi Digital"
  reputation: number; // 0-100 score
  signerAddress?: string; // Ethereum address (from SIWE)
  ensName?: string; // ENS name if available
  registeredAt: string;
}

export interface SectionListing {
  id: string;
  name: string;
  lineStart: number;
  lineEnd: number;
  pricePerLine: number; // in USD (USDC)
  description: string;
}

export interface DocumentListing {
  id: string;
  hostId: string;
  ddocId: string; // Fileverse ddocId (host's original)
  title: string;
  description: string;
  tags: string[];
  totalLines: number;
  merkleRoot: string; // on-chain anchored root (hex)
  anchorTx: string; // transaction hash
  anchorChain: string; // e.g. "sepolia"
  sections: SectionListing[];
  sellLineByLine: boolean; // if true, buyers can pick any line range
  pricePerLine: number; // default per-line price when selling line-by-line
  createdAt: string;
}

export interface Purchase {
  id: string;
  documentId: string;
  sectionId: string;
  buyerAddress: string;
  lineStart: number;
  lineEnd: number;
  totalCost: number;
  paymentTx: string | null;
  disclosedLines: string[];
  proofPackage: ProofPackage | null;
  status: "pending" | "fulfilled" | "failed";
  purchasedAt: string;
  fulfilledAt: string | null;
}

export interface ProofPackage {
  original_root: string;
  total_leaves: number;
  range_start: number;
  range_end: number;
  salts: string[];
  multi_proof: string;
}
