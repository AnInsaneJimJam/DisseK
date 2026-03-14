/**
 * ERC-8004 Agent Registration Script
 *
 * Registers an agent in the ERC-8004 Identity Registry on Base Sepolia.
 * After registration, you need to set an ENSIP-25 text record on the
 * parent ENS name attesting this agent.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx src/register-agent.ts [ensName]
 *
 * Registry: 0x8004A818BFB912233c491871b3d84c89A494BD9e (Base Sepolia)
 */

import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address;

const registerAbi = [
  parseAbiItem("function register(string calldata agentURI) external returns (uint256)"),
  parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
] as const;

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY env var (with 0x prefix)");
    process.exit(1);
  }

  const ensName = process.argv[2] || "demo-agent";
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || undefined;
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Build agent metadata URI
  const agentJson = {
    name: ensName,
    description: `DisseK marketplace agent for ${ensName}`,
    wallet: account.address,
    registeredAt: new Date().toISOString(),
  };
  const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(agentJson)).toString("base64")}`;

  console.log(`Registering agent for ${ensName}...`);
  console.log(`  Account: ${account.address}`);
  console.log(`  Registry: ${REGISTRY_ADDRESS}`);
  console.log(`  Chain: Base Sepolia (84532)`);

  const hash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: registerAbi,
    functionName: "register",
    args: [agentURI],
  });

  console.log(`  Tx: ${hash}`);
  console.log("  Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Block: ${receipt.blockNumber}`);

  // Parse Transfer event to get the agentId (tokenId)
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const transferLog = receipt.logs.find((l) => l.topics[0] === transferTopic);
  if (transferLog && transferLog.topics[3]) {
    const agentId = BigInt(transferLog.topics[3]).toString();
    console.log(`\n✅ Agent registered! agentId = ${agentId}`);
    console.log(`\nNext step: set ENSIP-25 text record on your ENS name.`);
    console.log(`  Key format: agent-registration[<erc7930(registry)>][${agentId}]`);
  } else {
    console.log("\n⚠️  Transaction succeeded but couldn't parse agentId from logs.");
    console.log("  Check the tx on basescan.org/sepolia");
  }
}

main().catch((err) => {
  console.error("Registration failed:", err.message);
  process.exit(1);
});
