/**
 * Proof Service
 * Wraps the Rust WASM DocumentTree to generate and verify Merkle proofs
 * for selective disclosure of document lines.
 */

// @ts-ignore — wasm-pack generated CJS module
import { DocumentTree } from "proof-engine";

export interface ProofPackage {
  original_root: string;
  total_leaves: number;
  range_start: number;
  range_end: number;
  salts: string[];
  multi_proof: string;
}

export interface DisclosureResult {
  disclosedLines: string[];
  proofPackage: ProofPackage;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Given the full document content, generate a Merkle proof for a selected
 * contiguous range of lines.
 *
 * @param content  - Full document content (newline-separated)
 * @param startLine - 0-indexed start line (inclusive)
 * @param endLine   - 0-indexed end line (inclusive)
 */
export function generateDisclosure(
  content: string,
  startLine: number,
  endLine: number
): DisclosureResult {
  const lines = content.split("\n");

  if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
    throw new Error(
      `Invalid line range [${startLine}, ${endLine}] for document with ${lines.length} lines`
    );
  }

  // 1. Build the Merkle tree from ALL lines
  const docTree = new DocumentTree(lines);
  const root = docTree.get_root();
  const totalLeaves = docTree.get_total_leaves();

  // 2. Extract the selected range
  const disclosedLines: string[] = [];
  const salts: string[] = [];

  for (let i = startLine; i <= endLine; i++) {
    disclosedLines.push(lines[i]!);
    salts.push(toHex(docTree.get_salt(i)));
  }

  // 3. Generate the multi-proof for the range
  const proofBytes = docTree.extract_range_proof(startLine, endLine);

  const proofPackage: ProofPackage = {
    original_root: toHex(root),
    total_leaves: totalLeaves,
    range_start: startLine,
    range_end: endLine,
    salts,
    multi_proof: toHex(proofBytes),
  };

  // Free WASM memory
  docTree.free();

  return { disclosedLines, proofPackage };
}

/**
 * Verify that disclosed lines + proof match an authoritative Merkle root.
 */
export function verifyDisclosure(
  disclosedLines: string[],
  proofPackage: ProofPackage
): boolean {
  const root = fromHex(proofPackage.original_root);
  const proofBytes = fromHex(proofPackage.multi_proof);
  const salts = proofPackage.salts.map((s) => fromHex(s));

  return DocumentTree.verify_range(
    root,
    proofPackage.range_start,
    disclosedLines,
    salts,
    proofBytes,
    proofPackage.total_leaves
  );
}
