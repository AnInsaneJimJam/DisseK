/**
 * x402 Payment Client (v2 — matches @x402/express on the server)
 *
 * Two modes:
 *   createPaidFetch()              – uses MetaMask (window.ethereum) on Base Sepolia
 *   createPaidFetchFromKey("0x…")  – uses a raw private key (for scripts / agents)
 */

import { createWalletClient, createPublicClient, custom, http, publicActions } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

type PaidFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Creates a paid fetch using MetaMask (browser wallet).
 * Prompts the user for account access if needed.
 */
export async function createPaidFetch(): Promise<PaidFetch> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error("No wallet found – please install MetaMask");
  }

  const [account] = await ethereum.request({ method: "eth_requestAccounts" });
  const addr = account as `0x${string}`;

  const walletClient = createWalletClient({
    account: addr,
    chain: baseSepolia,
    transport: custom(ethereum),
  }).extend(publicActions);

  // Compose a ClientEvmSigner: the browser wallet client doesn't expose
  // .address at the top level, so we wire it up explicitly.
  const signer = toClientEvmSigner(
    {
      address: addr,
      signTypedData: (msg: any) => walletClient.signTypedData(msg),
    },
    walletClient, // provides readContract
  );

  const client = new x402Client()
    .register("eip155:84532", new ExactEvmScheme(signer));

  return wrapFetchWithPayment(globalThis.fetch, client);
}

/**
 * Creates a paid fetch from a raw private key (for scripts / agents).
 */
export function createPaidFetchFromKey(privateKey: `0x${string}`): PaidFetch {
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const signer = toClientEvmSigner(account, publicClient);

  const client = new x402Client()
    .register("eip155:84532", new ExactEvmScheme(signer));

  return wrapFetchWithPayment(globalThis.fetch, client);
}
