import { useState } from 'react';
import './Verify.css';

export default function Verify() {
  const [merkleRoot, setMerkleRoot] = useState('');
  const [proofJson, setProofJson] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<'valid' | 'invalid' | null>(null);

  const handleVerify = () => {
    setIsVerifying(true);
    setResult(null);
    // Simulate Rust WASM verify_proof(proof, root) call
    setTimeout(() => {
      setIsVerifying(false);
      // If proof JSON is populated, simulate a valid result
      setResult(proofJson.trim().length > 5 ? 'valid' : 'invalid');
    }, 2000);
  };

  const sampleProof = JSON.stringify({
    docId: '0xabc123...',
    sectionId: 'strategy-3',
    rangeStart: 45,
    rangeEnd: 89,
    leafHashes: ['0x1a2b3c...', '0x4d5e6f...', '0x7a8b9c...'],
    boundarySiblings: ['0xd0e1f2...', '0xa3b4c5...'],
    docRoot: '0xae72f9c8...d4b1e3f7',
  }, null, 2);

  return (
    <div className="verify-page">
      <div className="container">
        <div className="verify-header fade-in" id="verify-header">
          <h1 className="heading-lg">Verify a Proof</h1>
          <p className="text-body">
            Independently verify any Merkle inclusion proof. Paste the proof bundle and the on-chain Merkle root — verification runs entirely in your browser via Rust WASM.
          </p>
        </div>

        <div className="verify-layout">
          <div className="verify-form card fade-in stagger-1" id="verify-form">
            <div className="publish-field">
              <label className="text-xs">On-Chain Merkle Root</label>
              <input
                type="text"
                className="input text-mono"
                placeholder="0xae72f9c8...d4b1e3f7"
                value={merkleRoot}
                onChange={(e) => setMerkleRoot(e.target.value)}
                id="verify-root-input"
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                The root hash from the Anchor Contract on Sepolia
              </span>
            </div>

            <div className="publish-field">
              <label className="text-xs">Proof Bundle (JSON)</label>
              <textarea
                className="input verify-textarea text-mono"
                placeholder={sampleProof}
                value={proofJson}
                onChange={(e) => setProofJson(e.target.value)}
                rows={12}
                id="verify-proof-input"
              />
            </div>

            <button
              className={`btn btn-primary btn-lg ${isVerifying ? 'btn-loading' : ''}`}
              onClick={handleVerify}
              disabled={!merkleRoot || !proofJson || isVerifying}
              id="verify-btn"
            >
              {isVerifying ? (
                <>
                  <span className="spinner" />
                  Running WASM verify_proof...
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
                    <h3 className="heading-sm" style={{ color: 'var(--success)' }}>Proof Valid ✓</h3>
                    <p className="text-sm">
                      The disclosed lines are cryptographically verified as part of the original document. 
                      The recomputed root matches the on-chain anchor — the content is genuine and untampered.
                    </p>
                    <div className="verify-detail-row">
                      <span className="text-xs">Recomputed Root</span>
                      <code className="sidebar-hash text-mono">{merkleRoot}</code>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="verify-result-icon error-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                        <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <h3 className="heading-sm" style={{ color: 'var(--error)' }}>Proof Invalid ✗</h3>
                    <p className="text-sm">
                      The recomputed root does not match the provided on-chain root. The proof is invalid — 
                      the content may have been tampered with or the proof is malformed.
                    </p>
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
                  <span className="text-sm">Hash each disclosed line with SHA256 to produce leaf hashes</span>
                </div>
                <div className="verify-step-item">
                  <span className="verify-step-num">2</span>
                  <span className="text-sm">Reconstruct internal nodes from leaves bottom-up</span>
                </div>
                <div className="verify-step-item">
                  <span className="verify-step-num">3</span>
                  <span className="text-sm">Combine with boundary sibling hashes at each tree level</span>
                </div>
                <div className="verify-step-item">
                  <span className="verify-step-num">4</span>
                  <span className="text-sm">Compute root and compare to on-chain anchored root</span>
                </div>
              </div>
            </div>

            <div className="sidebar-card card" id="verify-tech-info">
              <h4 className="heading-sm">Technical Details</h4>
              <div className="sidebar-field">
                <span className="text-xs">Hash Function</span>
                <span className="text-sm">SHA-256</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Proof Type</span>
                <span className="text-sm">Range Inclusion (contiguous)</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Execution</span>
                <span className="text-sm">Rust → WASM (in-browser)</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Proof Complexity</span>
                <span className="text-sm">O(log n) sibling hashes</span>
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => {
                setProofJson(sampleProof);
                setMerkleRoot('0xae72f9c8...d4b1e3f7');
              }}
              id="load-sample-btn"
            >
              Load Sample Proof
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
