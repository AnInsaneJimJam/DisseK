export const MERKLE_ANCHOR_ADDRESS = "0x95BF016F19f3281ac7C5FDF745563fB50De22c4F";
export const MERKLE_ANCHOR_CHAIN_ID = 11155111; // Sepolia

export const MERKLE_ANCHOR_ABI = [
  {
    inputs: [
      { internalType: "string", name: "docId", type: "string" },
      { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
      { internalType: "uint256", name: "totalLeaves", type: "uint256" },
    ],
    name: "anchorRoot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "docId", type: "string" }],
    name: "getRoot",
    outputs: [
      { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
      { internalType: "address", name: "host", type: "address" },
      { internalType: "uint256", name: "totalLeaves", type: "uint256" },
      { internalType: "uint256", name: "anchoredAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "docId", type: "string" },
      { internalType: "bytes32", name: "claimedRoot", type: "bytes32" },
    ],
    name: "verifyRoot",
    outputs: [{ internalType: "bool", name: "matches", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAnchored",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
