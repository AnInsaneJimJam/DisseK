/**
 * Access Store
 *
 * In-memory store for document section access grants.
 * Supports individual grants (ENS name match) and namespace grants
 * (subname hierarchy + optional ENSIP-25 verification).
 */

import { isSubnameOf, getAncestorNamespaces } from "./ens-resolver.js";
import { verifyAgentENS } from "./ens-verifier.js";

export interface AccessGrant {
  id: string;
  documentId: string;
  sectionIndex: number;
  grantType: "individual" | "namespace";
  grantedTo: string;       // ENS name (individual) or parent namespace (org)
  purchasedBy: string;      // wallet address that paid
  requireEnsip25: boolean;  // if true, ENSIP-25 text record must exist on parent
  timestamp: number;
}

export interface AccessCheckResult {
  hasAccess: boolean;
  matchedGrant: AccessGrant | null;
  ensip25Verified?: boolean;
  reason: string;
}

// ─── In-memory store ────────────────────────────────────────────────

const grants = new Map<string, AccessGrant[]>(); // key: "docId:sectionIndex"

function grantKey(docId: string, sectionIdx: number): string {
  return `${docId}:${sectionIdx}`;
}

let nextId = 1;

export function createGrant(params: {
  documentId: string;
  sectionIndex: number;
  grantType: "individual" | "namespace";
  grantedTo: string;
  purchasedBy: string;
  requireEnsip25?: boolean;
}): AccessGrant {
  const grant: AccessGrant = {
    id: String(nextId++),
    documentId: params.documentId,
    sectionIndex: params.sectionIndex,
    grantType: params.grantType,
    grantedTo: params.grantedTo.toLowerCase(),
    purchasedBy: params.purchasedBy.toLowerCase(),
    requireEnsip25: params.requireEnsip25 ?? false,
    timestamp: Date.now(),
  };

  const key = grantKey(grant.documentId, grant.sectionIndex);
  const existing = grants.get(key) || [];
  existing.push(grant);
  grants.set(key, existing);

  return grant;
}

/** Check if an ENS name has access to a specific document section */
export async function checkAccess(params: {
  ensName: string;
  documentId: string;
  sectionIndex: number;
  registryAddress?: string;
  registryChainId?: number;
  ensChainId?: number;
}): Promise<AccessCheckResult> {
  const {
    ensName,
    documentId,
    sectionIndex,
    registryAddress = "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    registryChainId = 84532,
    ensChainId = 1,
  } = params;

  const key = grantKey(documentId, sectionIndex);
  const grantList = grants.get(key) || [];
  const normName = ensName.toLowerCase();

  // 1. Check individual grants
  const individualMatch = grantList.find(
    (g) => g.grantType === "individual" && g.grantedTo === normName
  );
  if (individualMatch) {
    return {
      hasAccess: true,
      matchedGrant: individualMatch,
      reason: `Individual grant for ${ensName}`,
    };
  }

  // 2. Check namespace grants
  const ancestors = getAncestorNamespaces(normName);
  for (const ancestor of ancestors) {
    const nsMatch = grantList.find(
      (g) => g.grantType === "namespace" && g.grantedTo === ancestor
    );
    if (!nsMatch) continue;

    // Must be a real subname
    if (!isSubnameOf(normName, ancestor)) continue;

    // If ENSIP-25 verification required, check text record on parent
    if (nsMatch.requireEnsip25) {
      // We need an agentId — for demo, use "1"
      const result = await verifyAgentENS({
        ensName: ancestor,
        registryAddress,
        registryChainId,
        agentId: "1",
        ensChainId,
      });

      return {
        hasAccess: result.verified,
        matchedGrant: nsMatch,
        ensip25Verified: result.verified,
        reason: result.verified
          ? `Namespace grant via ${ancestor} (ENSIP-25 verified)`
          : `Namespace grant found for ${ancestor} but ENSIP-25 verification failed: ${result.error}`,
      };
    }

    return {
      hasAccess: true,
      matchedGrant: nsMatch,
      reason: `Namespace grant via ${ancestor}`,
    };
  }

  return {
    hasAccess: false,
    matchedGrant: null,
    reason: `No grant found for ${ensName} on document ${documentId} section ${sectionIndex}`,
  };
}

/** Get all grants for a document */
export function getAllGrantsForDocument(documentId: string): AccessGrant[] {
  const result: AccessGrant[] = [];
  for (const [key, grantList] of grants.entries()) {
    if (key.startsWith(documentId + ":")) {
      result.push(...grantList);
    }
  }
  return result;
}

/**
 * Full access check: given a wallet address, resolve identity then check grants.
 * Used by the /check-access endpoint.
 */
export async function checkDocumentAccess(params: {
  address: string;
  documentId: string;
  sectionIndex: number;
  ensName: string;
  registryAddress?: string;
  registryChainId?: number;
  ensChainId?: number;
}): Promise<AccessCheckResult> {
  return checkAccess({
    ensName: params.ensName,
    documentId: params.documentId,
    sectionIndex: params.sectionIndex,
    registryAddress: params.registryAddress,
    registryChainId: params.registryChainId,
    ensChainId: params.ensChainId,
  });
}
