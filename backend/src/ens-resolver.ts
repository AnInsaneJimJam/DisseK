/**
 * ENS Resolver Helpers
 *
 * Forward resolution (name → address), reverse resolution (address → name),
 * subname detection, and identity resolution for the DisseK marketplace.
 */

import {
  createPublicClient,
  http,
  type Chain,
  type Address,
  namehash,
} from "viem";
import { mainnet, sepolia, baseSepolia } from "viem/chains";
import { normalize } from "viem/ens";

// ─── Chain config ───────────────────────────────────────────────────

const CHAINS: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  84532: baseSepolia,
};

function getClient(chainId: number) {
  const chain = CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);

  const rpcMap: Record<number, string> = {
    1: "ETH_RPC_URL",
    11155111: "SEPOLIA_RPC_URL",
    84532: "BASE_SEPOLIA_RPC_URL",
  };
  const rpcUrl = process.env[rpcMap[chainId]] || undefined;

  return createPublicClient({ chain, transport: http(rpcUrl) });
}

// ─── Resolution ─────────────────────────────────────────────────────

/** Reverse resolve: address → ENS name (returns null if none) */
export async function reverseResolve(
  address: string,
  chainId: number = 1
): Promise<string | null> {
  try {
    const client = getClient(chainId);
    const name = await client.getEnsName({
      address: address as Address,
    });
    return name;
  } catch {
    return null;
  }
}

/** Forward resolve: ENS name → address (returns null if none) */
export async function forwardResolve(
  name: string,
  chainId: number = 1
): Promise<string | null> {
  try {
    const client = getClient(chainId);
    const addr = await client.getEnsAddress({
      name: normalize(name),
    });
    return addr;
  } catch {
    return null;
  }
}

// ─── Subname Utilities ──────────────────────────────────────────────

/** Extract the parent name (e.g., "bot.research.google.eth" → "research.google.eth") */
export function extractParentName(name: string): string | null {
  const parts = name.split(".");
  if (parts.length <= 2) return null; // "google.eth" has no parent
  return parts.slice(1).join(".");
}

/** Check if `name` is a subname of `parent` (e.g., "bot.research.google.eth" is under "research.google.eth") */
export function isSubnameOf(name: string, parent: string): boolean {
  const norm = name.toLowerCase();
  const normParent = parent.toLowerCase();
  return norm.endsWith("." + normParent) && norm.length > normParent.length + 1;
}

/** Get all ancestor namespaces of a name (e.g., "a.b.c.eth" → ["b.c.eth", "c.eth"]) */
export function getAncestorNamespaces(name: string): string[] {
  const parts = name.split(".");
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length - 1; i++) {
    ancestors.push(parts.slice(i).join("."));
  }
  return ancestors;
}

// ─── Identity Resolution ────────────────────────────────────────────

export interface ENSIdentity {
  address: string;
  ensName: string | null;
  forwardVerified: boolean;
  identityType: "individual" | "org-agent" | "unknown";
  parentName: string | null;
}

// Chains that have an ENS registry (used for multi-chain fallback)
const ENS_CHAIN_IDS = [1, 11155111]; // mainnet, Sepolia

/**
 * Full identity resolution:
 * 1. Reverse lookup address → name (tries requested chain, then fallbacks)
 * 2. Forward verify name → address (must match)
 * 3. Determine if individual (2-part name) or org agent (3+ parts = subname)
 */
export async function resolveIdentity(
  address: string,
  chainId: number = 1
): Promise<ENSIdentity> {
  // Build ordered list of chains to try: requested chain first, then other ENS chains
  const chainsToTry = [chainId, ...ENS_CHAIN_IDS.filter((c) => c !== chainId)];

  let ensName: string | null = null;
  let resolvedOnChain = chainId;

  for (const cid of chainsToTry) {
    // Only try chains we actually support
    if (!CHAINS[cid]) continue;
    const name = await reverseResolve(address, cid);
    if (name) {
      ensName = name;
      resolvedOnChain = cid;
      break;
    }
  }

  if (!ensName) {
    return {
      address,
      ensName: null,
      forwardVerified: false,
      identityType: "unknown",
      parentName: null,
    };
  }

  // Forward verification: the name must resolve back to this address
  const resolvedAddr = await forwardResolve(ensName, resolvedOnChain);
  const forwardVerified =
    !!resolvedAddr && resolvedAddr.toLowerCase() === address.toLowerCase();

  const parentName = extractParentName(ensName);
  const identityType: ENSIdentity["identityType"] = parentName
    ? "org-agent"
    : "individual";

  return {
    address,
    ensName,
    forwardVerified,
    identityType,
    parentName,
  };
}
