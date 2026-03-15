/**
 * x402 Payment Client for DisseK.
 *
 * Supports two signer modes:
 *   1. MetaMask (browser wallet) — uses viem WalletClient + custom transport
 *   2. Private key              — uses viem privateKeyToAccount
 *
 * Usage:
 *   const paidFetch = await createPaidFetch();          // MetaMask
 *   const paidFetch = createPaidFetchFromKey("0x...");   // Private key
 *   const res = await paidFetch("/api/documents/123/purchase", { method: "POST", ... });
 */

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  custom,
  type WalletClient,
  type Account,
} from "viem";
import { baseSepolia } from "viem/chains";

// ─── Types ───────────────────────────────────────────────────────────

export type PaidFetch = typeof fetch;

// ─── MetaMask / Browser Wallet ───────────────────────────────────────

/**
 * Create a viem WalletClient from window.ethereum (MetaMask).
 * The user must already be connected (address known).
 */
async function getViemWalletClient(): Promise<WalletClient> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No Ethereum wallet found. Install MetaMask.");

  const [address] = await ethereum.request({ method: "eth_requestAccounts" });

  return createWalletClient({
    account: address as `0x${string}`,
    chain: baseSepolia,
    transport: custom(ethereum),
  });
}

/**
 * Create a paid fetch that uses the connected MetaMask wallet to sign
 * x402 payment authorisations. On 402 responses the payment is
 * handled automatically — the user just sees a MetaMask signature prompt.
 */
export async function createPaidFetch(): Promise<PaidFetch> {
  const walletClient = await getViemWalletClient();

  const client = new x402Client();
  client.register(
    "eip155:84532",
    new ExactEvmScheme(walletClient.account as Account)
  );
  client.register(
    "eip155:8453",
    new ExactEvmScheme(walletClient.account as Account)
  );

  return wrapFetchWithPayment(fetch, client);
}

// ─── Private Key ─────────────────────────────────────────────────────

/**
 * Create a paid fetch from a hex private key.
 * Useful for demos, scripts, or agent-based flows.
 */
export function createPaidFetchFromKey(
  privateKey: `0x${string}`
): PaidFetch {
  const account = privateKeyToAccount(privateKey);

  const client = new x402Client();
  client.register("eip155:84532", new ExactEvmScheme(account));
  client.register("eip155:8453", new ExactEvmScheme(account));

  return wrapFetchWithPayment(fetch, client);
}
