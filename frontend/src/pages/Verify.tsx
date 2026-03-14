import { useState } from 'react';
import { verifyProof } from '../api/marketplace';
import './Verify.css';

const BACKEND_URL = "http://localhost:3001";

interface AgentVerificationResult {
  verified: boolean;
  ensName: string;
  textRecordKey: string;
  textRecordValue: string | null;
  resolverAddress: string | null;
  erc7930Encoding?: string;
  error?: string;
}

function AgentVerifier() {
  const [ensName, setEnsName] = useState('');
  const [registryAddress, setRegistryAddress] = useState('0x8004A818BFB912233c491871b3d84c89A494BD9e');
  const [registryChainId, setRegistryChainId] = useState('84532');
  const [agentId, setAgentId] = useState('1');
  const [ensChainId, setEnsChainId] = useState('1');
  const [result, setResult] = useState<AgentVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/verify-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ensName,
          registryAddress,
          registryChainId: Number(registryChainId),
          agentId,
          ensChainId: Number(ensChainId),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ensChainOptions = [
    { id: '1', label: 'Mainnet' },
    { id: '11155111', label: 'Sepolia' },
    { id: '84532', label: 'Base Sepolia' },
  ];

  return (
    <div className="agent-verifier card fade-in stagger-3" id="agent-verifier">
      <h3 className="heading-sm">🔍 ENSIP-25 Agent Verification</h3>
      <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Verify that an ENS name has an agent attestation text record (ENSIP-25 / ERC-8004).
      </p>

      <div className="agent-verifier-fields">
        <div className="publish-field">
          <label className="text-xs">ENS Name</label>
          <input className="input" placeholder="e.g. myagent.eth" value={ensName} onChange={e => setEnsName(e.target.value)} />
        </div>
        <div className="publish-field">
          <label className="text-xs">Registry Address</label>
          <input className="input text-mono" value={registryAddress} onChange={e => setRegistryAddress(e.target.value)} />
        </div>
        <div className="agent-verifier-row">
          <div className="publish-field">
            <label className="text-xs">Registry Chain ID</label>
            <input className="input" value={registryChainId} onChange={e => setRegistryChainId(e.target.value)} />
          </div>
          <div className="publish-field">
            <label className="text-xs">Agent ID</label>
            <input className="input" value={agentId} onChange={e => setAgentId(e.target.value)} />
          </div>
        </div>
        <div className="publish-field">
          <label className="text-xs">ENS Resolution Network</label>
          <div className="ens-chain-toggle">
            {ensChainOptions.map(opt => (
              <button
                key={opt.id}
                className={`btn btn-sm ${ensChainId === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setEnsChainId(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
        onClick={handleVerify}
        disabled={!ensName || loading}
        style={{ marginTop: '1rem' }}
      >
        {loading ? <><span className="spinner" /> Verifying...</> : 'Verify Agent'}
      </button>

      {error && <div className="verify-result invalid" style={{ marginTop: '1rem' }}><p className="text-sm">{error}</p></div>}

      {result && (
        <div className={`verify-result ${result.verified ? 'valid' : 'invalid'}`} style={{ marginTop: '1rem' }}>
          <h4 className="heading-sm" style={{ color: result.verified ? 'var(--success)' : 'var(--error)' }}>
            {result.verified ? '✅ Agent Verified' : '❌ Not Verified'}
          </h4>
          <div className="sidebar-field"><span className="text-xs">ENS Name</span><span className="text-sm">{result.ensName}</span></div>
          <div className="sidebar-field"><span className="text-xs">Text Record Key</span><code className="sidebar-hash text-mono" style={{ fontSize: '0.65rem' }}>{result.textRecordKey}</code></div>
          {result.textRecordValue && <div className="sidebar-field"><span className="text-xs">Value</span><span className="text-sm">{result.textRecordValue}</span></div>}
          {result.resolverAddress && <div className="sidebar-field"><span className="text-xs">Resolver</span><code className="sidebar-hash text-mono">{result.resolverAddress}</code></div>}
          {result.erc7930Encoding && <div className="sidebar-field"><span className="text-xs">ERC-7930</span><code className="sidebar-hash text-mono" style={{ fontSize: '0.6rem' }}>{result.erc7930Encoding}</code></div>}
          {result.error && <div className="sidebar-field"><span className="text-xs">Error</span><span className="text-sm" style={{ color: 'var(--error)' }}>{result.error}</span></div>}
        </div>
      )}
    </div>
  );
}

export default function Verify() {
  const [proofJson, setProofJson] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<'valid' | 'invalid' | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [parsedRoot, setParsedRoot] = useState('');

  const handleVerify = async () => {
    setIsVerifying(true);
    setResult(null);
    setResultMessage('');

    try {
      const parsed = JSON.parse(proofJson);
      const { disclosedLines, proofPackage } = parsed;

      if (!disclosedLines || !proofPackage) {
        throw new Error('JSON must contain "disclosedLines" (string[]) and "proofPackage" (object)');
      }

      setParsedRoot(proofPackage.original_root || '');

      const res = await verifyProof(disclosedLines, proofPackage);
      setResult(res.verified ? 'valid' : 'invalid');
      setResultMessage(res.message);
    } catch (err: any) {
      setResult('invalid');
      setResultMessage(err.message || 'Failed to verify');
    } finally {
      setIsVerifying(false);
    }
  };

  const sampleProof = JSON.stringify({
    disclosedLines: [
      "This is line 2 containing some data.",
      "This is line 3 with public info.",
      "This is line 4 - shared section ends here."
    ],
    proofPackage: {
      original_root: "<hex merkle root>",
      total_leaves: 16,
      range_start: 2,
      range_end: 4,
      salts: ["<hex salt for line 2>", "<hex salt for line 3>", "<hex salt for line 4>"],
      multi_proof: "<hex encoded proof bytes>"
    }
  }, null, 2);

  return (
    <div className="verify-page">
      <div className="container">
        <div className="verify-header fade-in" id="verify-header">
          <h1 className="heading-lg">Verify a Proof</h1>
          <p className="text-body">
            Independently verify any Merkle inclusion proof. Paste the disclosure bundle containing the disclosed lines and proof package.
          </p>
        </div>

        <div className="verify-layout">
          <div className="verify-form card fade-in stagger-1" id="verify-form">
            <div className="publish-field">
              <label className="text-xs">Disclosure Bundle (JSON)</label>
              <textarea
                className="input verify-textarea text-mono"
                placeholder={sampleProof}
                value={proofJson}
                onChange={(e) => setProofJson(e.target.value)}
                rows={16}
                id="verify-proof-input"
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Must contain "disclosedLines" (string array) and "proofPackage" (with original_root, total_leaves, range_start, range_end, salts, multi_proof)
              </span>
            </div>

            <button
              className={`btn btn-primary btn-lg ${isVerifying ? 'btn-loading' : ''}`}
              onClick={handleVerify}
              disabled={!proofJson || isVerifying}
              id="verify-btn"
            >
              {isVerifying ? (
                <>
                  <span className="spinner" />
                  Verifying via WASM engine...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                  </svg>
                  Verify Proof
                </>
              )}
            </button>

            {result && (
              <div className={`verify-result ${result}`} id="verify-result">
                {result === 'valid' ? (
                  <>
                    <div className="verify-result-icon success-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <h3 className="heading-sm" style={{ color: 'var(--success)' }}>Proof Valid</h3>
                    <p className="text-sm">{resultMessage}</p>
                    {parsedRoot && (
                      <div className="verify-detail-row">
                        <span className="text-xs">Merkle Root</span>
                        <code className="sidebar-hash text-mono">{parsedRoot}</code>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="verify-result-icon error-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                        <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="heading-sm" style={{ color: 'var(--error)' }}>Proof Invalid</h3>
                    <p className="text-sm">{resultMessage}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="verify-sidebar fade-in stagger-2">
            <div className="sidebar-card card" id="verify-info">
              <h4 className="heading-sm">How Verification Works</h4>
              <div className="verify-steps-list">
                <div className="verify-step-item">
                  <span className="verify-step-num">1</span>
                  <span className="text-sm">Hash each disclosed line with its salt using domain-separated SHA-256</span>
                </div>
                <div className="verify-step-item">
                  <span className="verify-step-num">2</span>
                  <span className="text-sm">Reconstruct internal nodes from leaves bottom-up</span>
                </div>
                <div className="verify-step-item">
                  <span className="verify-step-num">3</span>
                  <span className="text-sm">Combine with sibling hashes from the multi-proof</span>
                </div>
                <div className="verify-step-item">
                  <span className="verify-step-num">4</span>
                  <span className="text-sm">Compute root and compare to the original_root in the proof package</span>
                </div>
              </div>
            </div>

            <div className="sidebar-card card" id="verify-tech-info">
              <h4 className="heading-sm">Technical Details</h4>
              <div className="sidebar-field">
                <span className="text-xs">Hash Function</span>
                <span className="text-sm">SHA-256 (domain-separated)</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Proof Type</span>
                <span className="text-sm">Range Inclusion (contiguous)</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Execution</span>
                <span className="text-sm">Rust WASM (server-side)</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Proof Complexity</span>
                <span className="text-sm">O(log n) sibling hashes</span>
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setProofJson(sampleProof)}
              id="load-sample-btn"
            >
              Load Sample Format
            </button>
          </aside>
        </div>

        {/* ENSIP-25 Agent Verification Section */}
        <div style={{ marginTop: '2rem' }}>
          <AgentVerifier />
        </div>
      </div>
    </div>
  );
}
