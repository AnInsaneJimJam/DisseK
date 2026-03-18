/**
 * USDC Contract on Sepolia
 * Used for direct payments from buyer to publisher.
 */

// USDC on Sepolia (Circle's official testnet deployment)
export const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Minimal ERC-20 ABI — only the functions we need
export const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
] as const;

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

/**
 * Convert a dollar amount to USDC's smallest unit (6 decimals).
 * e.g. $1.50 → 1_500_000
 */
export function usdToUsdcUnits(usdAmount: number): bigint {
    // Multiply by 10^6 and round to avoid floating point errors
    return BigInt(Math.round(usdAmount * 10 ** USDC_DECIMALS));
}
