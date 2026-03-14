import { useState } from 'react';
import { verifyProof } from '../api/marketplace';
import './Verify.css';

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
      </div>
    </div>
  );
}
