export interface Section {
  id: string;
  name: string;
  lineStart: number;
  lineEnd: number;
  price: number;
  currency: string;
  isFree: boolean;
  preview: string;
}

export interface Document {
  id: string;
  title: string;
  author: string;
  authorAddress: string;
  description: string;
  tags: string[];
  sections: Section[];
  totalLines: number;
  merkleRoot: string;
  anchorTx: string;
  createdAt: string;
  verified: boolean;
  purchases: number;
}

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc-001',
    title: 'DeFi Alpha: Q1 2026 Yield Strategies',
    author: 'Artemis Research',
    authorAddress: '0x1a2b...3c4d',
    description: 'Deep-dive into 5 high-conviction yield strategies across Ethereum L2s. Includes backtested data, risk parameters, and deployment scripts.',
    tags: ['DeFi', 'Research', 'Alpha'],
    sections: [
      { id: 'sec-001', name: 'Executive Summary', lineStart: 1, lineEnd: 15, price: 0, currency: 'USDC', isFree: true, preview: 'Overview of Q1 2026 DeFi yield landscape and key findings...' },
      { id: 'sec-002', name: 'Strategy 1: Recursive Lending', lineStart: 16, lineEnd: 45, price: 0.03, currency: 'USDC', isFree: false, preview: 'Leverages Aave V4 e-mode with...' },
      { id: 'sec-003', name: 'Strategy 2: LP Rebalancing', lineStart: 46, lineEnd: 82, price: 0.05, currency: 'USDC', isFree: false, preview: 'Automated concentrated liquidity management on...' },
      { id: 'sec-004', name: 'Strategy 3: Basis Trade Automation', lineStart: 83, lineEnd: 130, price: 0.08, currency: 'USDC', isFree: false, preview: 'Perpetual futures basis capture with delta hedging...' },
      { id: 'sec-005', name: 'Strategy 4: Points Arbitrage', lineStart: 131, lineEnd: 165, price: 0.05, currency: 'USDC', isFree: false, preview: 'Multi-protocol points farming with optimal capital routing...' },
      { id: 'sec-006', name: 'Strategy 5: RWA Yield Stack', lineStart: 166, lineEnd: 200, price: 0.12, currency: 'USDC', isFree: false, preview: 'Tokenised treasury yield with on-chain leverage...' },
    ],
    totalLines: 200,
    merkleRoot: '0xae72f9c...d4b1',
    anchorTx: '0x7f3a...b2c1',
    createdAt: '2026-03-10',
    verified: true,
    purchases: 347,
  },
  {
    id: 'doc-002',
    title: 'Smart Contract Security Audit: Uniswap V5',
    author: 'Zellic Audits',
    authorAddress: '0x5e6f...7a8b',
    description: 'Full security audit report covering all V5 contracts, including the new singleton architecture and hook system.',
    tags: ['Security', 'Audit', 'DeFi'],
    sections: [
      { id: 'sec-007', name: 'Scope & Methodology', lineStart: 1, lineEnd: 20, price: 0, currency: 'USDC', isFree: true, preview: 'Audit scope covering 12 contracts across the V5 suite...' },
      { id: 'sec-008', name: 'Critical Findings', lineStart: 21, lineEnd: 55, price: 0.15, currency: 'USDC', isFree: false, preview: 'Two critical vulnerabilities identified in the hook callback...' },
      { id: 'sec-009', name: 'High Severity Issues', lineStart: 56, lineEnd: 90, price: 0.10, currency: 'USDC', isFree: false, preview: 'Reentrancy vector in flash accounting module...' },
      { id: 'sec-010', name: 'Gas Optimization Report', lineStart: 91, lineEnd: 120, price: 0.05, currency: 'USDC', isFree: false, preview: 'Estimated 23% gas savings through transient storage usage...' },
    ],
    totalLines: 120,
    merkleRoot: '0xb3c8e1f...7a2d',
    anchorTx: '0x2d4e...8f1a',
    createdAt: '2026-03-08',
    verified: true,
    purchases: 189,
  },
  {
    id: 'doc-003',
    title: 'AI Agent Architecture Patterns',
    author: 'DeepMind Research',
    authorAddress: '0x9c0d...1e2f',
    description: 'Internal architecture patterns for building autonomous AI agents with on-chain identity, memory persistence, and multi-step reasoning.',
    tags: ['AI', 'Research', 'Architecture'],
    sections: [
      { id: 'sec-011', name: 'Introduction & Background', lineStart: 1, lineEnd: 25, price: 0, currency: 'USDC', isFree: true, preview: 'The evolution of autonomous agents from prompt-based to...' },
      { id: 'sec-012', name: 'Memory Architecture', lineStart: 26, lineEnd: 70, price: 0.08, currency: 'USDC', isFree: false, preview: 'Three-tier memory system: working, episodic, and semantic...' },
      { id: 'sec-013', name: 'Tool Orchestration', lineStart: 71, lineEnd: 115, price: 0.08, currency: 'USDC', isFree: false, preview: 'Dynamic tool selection with capability scoring and fallback...' },
      { id: 'sec-014', name: 'On-chain Identity (ENSIP-25)', lineStart: 116, lineEnd: 145, price: 0.06, currency: 'USDC', isFree: false, preview: 'Binding autonomous agents to organisational ENS namespaces...' },
      { id: 'sec-015', name: 'Evaluation Framework', lineStart: 146, lineEnd: 180, price: 0.10, currency: 'USDC', isFree: false, preview: 'Benchmarking agent performance across task complexity tiers...' },
    ],
    totalLines: 180,
    merkleRoot: '0xd4e5f6a...8b3c',
    anchorTx: '0x6a7b...c8d9',
    createdAt: '2026-03-12',
    verified: true,
    purchases: 512,
  },
  {
    id: 'doc-004',
    title: 'MEV Extraction: Post-PBS Landscape',
    author: 'Flashbots Collective',
    authorAddress: '0x3f4a...5b6c',
    description: 'Analysis of MEV dynamics after proposer-builder separation, covering new attack vectors, mitigation strategies, and the evolving role of searchers.',
    tags: ['MEV', 'Research', 'Infrastructure'],
    sections: [
      { id: 'sec-016', name: 'Current State of MEV', lineStart: 1, lineEnd: 30, price: 0, currency: 'USDC', isFree: true, preview: 'Post-merge MEV landscape: $1.2B extracted in 2025...' },
      { id: 'sec-017', name: 'Novel Attack Vectors', lineStart: 31, lineEnd: 75, price: 0.10, currency: 'USDC', isFree: false, preview: 'Cross-domain MEV through shared sequencing and forced...' },
      { id: 'sec-018', name: 'Mitigation Strategies', lineStart: 76, lineEnd: 120, price: 0.08, currency: 'USDC', isFree: false, preview: 'Encrypted mempools, batch auctions, and order flow...' },
    ],
    totalLines: 120,
    merkleRoot: '0xe5f6a7b...9c4d',
    anchorTx: '0x8b9c...d0e1',
    createdAt: '2026-03-06',
    verified: true,
    purchases: 276,
  },
  {
    id: 'doc-005',
    title: 'ZK-Proof Market Analysis 2026',
    author: 'Delphi Digital',
    authorAddress: '0x7d8e...9f0a',
    description: 'Comprehensive analysis of the ZK proof market including proof generation costs, hardware trends, and competitive landscape across major proof systems.',
    tags: ['ZK', 'Research', 'Market Analysis'],
    sections: [
      { id: 'sec-019', name: 'Market Overview', lineStart: 1, lineEnd: 20, price: 0, currency: 'USDC', isFree: true, preview: 'The ZK proof market reached $340M in 2025...' },
      { id: 'sec-020', name: 'Proof System Benchmarks', lineStart: 21, lineEnd: 60, price: 0.06, currency: 'USDC', isFree: false, preview: 'Head-to-head comparison: Groth16 vs PLONK vs STARK...' },
      { id: 'sec-021', name: 'Hardware Acceleration Trends', lineStart: 61, lineEnd: 95, price: 0.06, currency: 'USDC', isFree: false, preview: 'GPU proving: NVIDIA H100 vs custom ASICs for MSM...' },
      { id: 'sec-022', name: 'Competitive Landscape', lineStart: 96, lineEnd: 140, price: 0.08, currency: 'USDC', isFree: false, preview: 'Succinct, RISC Zero, Aligned Layer market positioning...' },
    ],
    totalLines: 140,
    merkleRoot: '0xf6a7b8c...0d5e',
    anchorTx: '0xa0b1...c2d3',
    createdAt: '2026-03-11',
    verified: true,
    purchases: 423,
  },
  {
    id: 'doc-006',
    title: 'Cross-Chain Bridge Security Report',
    author: 'Trail of Bits',
    authorAddress: '0x2b3c...4d5e',
    description: 'Post-mortem analysis of bridge exploits from 2023-2025 with a security framework for evaluating bridge implementations.',
    tags: ['Security', 'Infrastructure', 'Bridges'],
    sections: [
      { id: 'sec-023', name: 'Bridge Exploit Timeline', lineStart: 1, lineEnd: 35, price: 0, currency: 'USDC', isFree: true, preview: '$2.8B lost across 14 bridge exploits from 2022-2025...' },
      { id: 'sec-024', name: 'Vulnerability Taxonomy', lineStart: 36, lineEnd: 80, price: 0.12, currency: 'USDC', isFree: false, preview: 'Classification by attack surface: validator compromise, smart contract...' },
      { id: 'sec-025', name: 'Security Framework', lineStart: 81, lineEnd: 115, price: 0.10, currency: 'USDC', isFree: false, preview: 'A 7-dimension security scoring system for bridge evaluation...' },
    ],
    totalLines: 115,
    merkleRoot: '0xa7b8c9d...1e6f',
    anchorTx: '0xd4e5...f6a7',
    createdAt: '2026-03-05',
    verified: true,
    purchases: 198,
  },
];

export const TAGS = ['All', 'DeFi', 'Security', 'Research', 'AI', 'ZK', 'MEV', 'Infrastructure'];

export const STATS = {
  totalDocuments: 127,
  totalSectionsSold: 3412,
  totalRevenue: '$12.4k',
  activeAuthors: 48,
};
