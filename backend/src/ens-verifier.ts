/**
 * ENSIP-25 Agent Verification
 *
 * Verifies that an ENS name has a text record attesting an agent
 * in an ERC-8004 registry, using the ENSIP-25 parameterised key format:
 *   agent-registration[<erc7930_registry_addr>][<agentId>]
 *
 * ERC-7930 interoperable address encoding (big-endian):
 *   [2B namespace 0x0001][2B reserved 0x0000][1B chainIdLen][NB chainId][1B addrLen 0x14][20B address]
 */

import {
  createPublicClient,
  http,
  type Chain,
  type PublicClient,
  namehash,
  type Address,
} from "viem";
import { mainnet, sepolia, baseSepolia } from "viem/chains";
import { normalize } from "viem/ens";

// ─── ERC-7930 Encoding ─────────────────────────────────────────────

/** Encode a chain ID as minimal big-endian bytes */
function encodeChainIdBytes(chainId: number): Uint8Array {
  if (chainId === 0) return new Uint8Array([0]);
  const hex = chainId.toString(16);
  const padded = hex.length % 2 === 0 ? hex : "0" + hex;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Encode an address into ERC-7930 interoperable format */
export function encodeErc7930(address: string, chainId: number): string {
  const addrBytes = Buffer.from(address.replace("0x", ""), "hex");
  const chainIdBytes = encodeChainIdBytes(chainId);

  const buf = Buffer.alloc(2 + 2 + 1 + chainIdBytes.length + 1 + addrBytes.length);
  let offset = 0;

  // Namespace: 0x0001 (EVM)
  buf.writeUInt16BE(0x0001, offset); offset += 2;
  // Reserved: 0x0000
  buf.writeUInt16BE(0x0000, offset); offset += 2;
  // Chain ID length + bytes
  buf.writeUInt8(chainIdBytes.length, offset); offset += 1;
  Buffer.from(chainIdBytes).copy(buf, offset); offset += chainIdBytes.length;
  // Address length + bytes
  buf.writeUInt8(addrBytes.length, offset); offset += 1;
  addrBytes.copy(buf, offset);

  return "0x" + buf.toString("hex");
}

// ─── ENSIP-25 Text Record Key ───────────────────────────────────────

/**
 * Build the ENSIP-25 text record key:
 *   agent-registration[<erc7930(registryAddress, registryChainId)>][<agentId>]
 */
export function buildAgentTextRecordKey(
  registryAddress: string,
  registryChainId: number,
  agentId: string
): string {
  const encoded = encodeErc7930(registryAddress, registryChainId);
  return `agent-registration[${encoded}][${agentId}]`;
}

// ─── Multi-chain ENS Resolution ─────────────────────────────────────

const SUPPORTED_ENS_CHAINS: Record<number, Chain> = {
  1: mainnet,
  11155111: sepolia,
  84532: baseSepolia,
};

function getClient(chainId: number): PublicClient {
  const chain = SUPPORTED_ENS_CHAINS[chainId];
  if (!chain) throw new Error(`Unsupported ENS chain: ${chainId}`);

  // Pick RPC from env if available
  const rpcEnvMap: Record<number, string> = {
    1: "ETH_RPC_URL",
    11155111: "SEPOLIA_RPC_URL",
    84532: "BASE_SEPOLIA_RPC_URL",
  };
  const rpcUrl = process.env[rpcEnvMap[chainId]] || undefined;

  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

// ENS Public Resolver getText ABI (minimal)
const resolverAbi = [
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// ENS Registry getResolver ABI
const registryAbi = [
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// Mainnet ENS registry address (same on all chains that support ENS)
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as Address;

export interface AgentVerificationResult {
  verified: boolean;
  ensName: string;
  textRecordKey: string;
  textRecordValue: string | null;
  resolverAddress: string | null;
  error?: string;
}

/**
 * Verify an agent's ENSIP-25 text record on a given ENS chain.
 */
export async function verifyAgentENS(params: {
  ensName: string;
  registryAddress: string;
  registryChainId: number;
  agentId: string;
  ensChainId?: number;
}): Promise<AgentVerificationResult> {
  const {
    ensName,
    registryAddress,
    registryChainId,
    agentId,
    ensChainId = 1,
  } = params;

  const textRecordKey = buildAgentTextRecordKey(registryAddress, registryChainId, agentId);

  try {
    const client = getClient(ensChainId);
    const node = namehash(normalize(ensName));

    // 1. Get resolver address from ENS registry
    const resolverAddr = await client.readContract({
      address: ENS_REGISTRY,
      abi: registryAbi,
      functionName: "resolver",
      args: [node],
    });

    if (!resolverAddr || resolverAddr === "0x0000000000000000000000000000000000000000") {
      return {
        verified: false,
        ensName,
        textRecordKey,
        textRecordValue: null,
        resolverAddress: null,
        error: `No resolver set for ${ensName}`,
      };
    }

    // 2. Read the text record from the resolver
    const value = await client.readContract({
      address: resolverAddr as Address,
      abi: resolverAbi,
      functionName: "text",
      args: [node, textRecordKey],
    });

    const hasRecord = typeof value === "string" && value.length > 0;

    return {
      verified: hasRecord,
      ensName,
      textRecordKey,
      textRecordValue: value || null,
      resolverAddress: resolverAddr,
      error: hasRecord ? undefined : `No text record found for key: ${textRecordKey}`,
    };
  } catch (err: any) {
    return {
      verified: false,
      ensName,
      textRecordKey,
      textRecordValue: null,
      resolverAddress: null,
      error: err.message,
    };
  }
}
