import { useState } from 'react';
import './Publish.css';

interface SectionDef {
  name: string;
  lineStart: string;
  lineEnd: string;
  price: string;
}

export default function Publish() {
  const [step, setStep] = useState(1);
  const [fileverseUrl, setFileverseUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [sections, setSections] = useState<SectionDef[]>([
    { name: '', lineStart: '', lineEnd: '', price: '' },
  ]);
  const [merkleRoot, setMerkleRoot] = useState('');
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [isAnchored, setIsAnchored] = useState(false);

  const handleExtract = () => {
    setIsExtracting(true);
    // Simulate Fileverse DOM extraction
    setTimeout(() => {
      setLines([
        'Executive Summary: This report covers five emerging DeFi strategies...',
        'The current state of DeFi in Q1 2026 shows significant growth in...',
        'Strategy 1: Recursive lending leverages Aave V4 e-mode...',
        'Risk parameters: LTV 85%, liquidation threshold 90%...',
        'Expected APY: 12-18% depending on market conditions...',
        'Strategy 2: LP Rebalancing automates concentrated liquidity...',
        'Using Uniswap V4 hooks for dynamic fee adjustment...',
        'Backtested returns show 23% improvement over static ranges...',
        'Strategy 3: Basis Trade Automation captures funding rate...',
        'Delta-neutral positioning through perpetual futures...',
        'Estimated monthly yield: 2.4% with controlled drawdown...',
        'Strategy 4: Points Arbitrage across multiple protocols...',
        'Capital efficiency optimized through flash loan routing...',
        'Historical data shows 31% annualized returns...',
        'Strategy 5: RWA Yield Stack combines tokenized treasuries...',
        'On-chain leverage through Morpho for enhanced yield...',
      ]);
      setIsExtracting(false);
      setStep(2);
    }, 2000);
  };

  const addSection = () => {
    setSections([...sections, { name: '', lineStart: '', lineEnd: '', price: '' }]);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: keyof SectionDef, value: string) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: value };
    setSections(updated);
  };

  const handleBuildTree = () => {
    // Simulate Rust WASM build_tree()
    setMerkleRoot('0xae72f9c8...d4b1e3f7');
    setStep(3);
  };

  const handleAnchor = () => {
    setIsAnchoring(true);
    // Simulate on-chain anchoring tx
    setTimeout(() => {
      setIsAnchoring(false);
      setIsAnchored(true);
    }, 2500);
  };

  return (
    <div className="publish-page">
      <div className="container">
        <div className="publish-header fade-in" id="publish-header">
          <h1 className="heading-lg">Publish a Document</h1>
          <p className="text-body">Import from Fileverse, define sections with prices, and anchor the Merkle root on-chain.</p>
        </div>

        {/* Progress Steps */}
        <div className="publish-steps fade-in" id="publish-progress">
          {[
            { num: 1, label: 'Import' },
            { num: 2, label: 'Define Sections' },
            { num: 3, label: 'Anchor On-Chain' },
          ].map((s) => (
            <div key={s.num} className={`publish-step ${step >= s.num ? 'active' : ''} ${step > s.num ? 'done' : ''}`}>
              <div className="publish-step-circle">
                {step > s.num ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span className="publish-step-label">{s.label}</span>
              {s.num < 3 && <div className="publish-step-line" />}
            </div>
          ))}
        </div>

        <div className="publish-content">
          {/* Step 1: Import */}
          {step === 1 && (
            <div className="publish-card card fade-in" id="step-import">
              <h2 className="heading-md">Import from Fileverse</h2>
              <p className="text-sm">Paste the invite link to your Fileverse document. Content will be extracted from the ProseMirror editor after decryption.</p>

              <div className="publish-field">
                <label className="text-xs">Fileverse Document URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://docs.fileverse.io/..."
                  value={fileverseUrl}
                  onChange={(e) => setFileverseUrl(e.target.value)}
                  id="fileverse-url-input"
                />
              </div>

              <button
                className={`btn btn-primary ${isExtracting ? 'btn-loading' : ''}`}
                onClick={handleExtract}
                disabled={!fileverseUrl || isExtracting}
                id="extract-btn"
              >
                {isExtracting ? (
                  <>
                    <span className="spinner" />
                    Extracting from ProseMirror...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round"/>
                      <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Extract Document
                  </>
                )}
              </button>

              <div className="publish-info-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round"/>
                </svg>
                <span className="text-xs">
                  Documents are end-to-end encrypted on Fileverse. Content is read from the browser DOM after client-side decryption — no keys are exposed.
                </span>
              </div>
            </div>
          )}

          {/* Step 2: Define Sections */}
          {step === 2 && (
            <div className="publish-card card fade-in" id="step-define">
              <h2 className="heading-md">Define Sections & Pricing</h2>
              <p className="text-sm">Select line ranges, name each section, and set a price in USDC. Free sections are discoverable but have no paywall.</p>

              <div className="extracted-preview">
                <div className="extracted-preview-header">
                  <span className="text-xs">Extracted Content</span>
                  <span className="badge badge-success">{lines.length} lines</span>
                </div>
                <div className="extracted-lines">
                  {lines.map((line, i) => (
                    <div key={i} className="extracted-line">
                      <span className="line-num text-mono">{i + 1}</span>
                      <span className="line-content text-sm">{line}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sections-editor" id="sections-editor">
                {sections.map((sec, idx) => (
                  <div key={idx} className="section-editor-row">
                    <div className="section-editor-fields">
                      <div className="publish-field">
                        <label className="text-xs">Section Name</label>
                        <input
                          className="input"
                          placeholder="e.g. Strategy 3"
                          value={sec.name}
                          onChange={(e) => updateSection(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div className="section-editor-range">
                        <div className="publish-field">
                          <label className="text-xs">Start Line</label>
                          <input
                            className="input"
                            type="number"
                            placeholder="1"
                            value={sec.lineStart}
                            onChange={(e) => updateSection(idx, 'lineStart', e.target.value)}
                          />
                        </div>
                        <span className="range-dash">–</span>
                        <div className="publish-field">
                          <label className="text-xs">End Line</label>
                          <input
                            className="input"
                            type="number"
                            placeholder={String(lines.length)}
                            value={sec.lineEnd}
                            onChange={(e) => updateSection(idx, 'lineEnd', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="publish-field">
                        <label className="text-xs">Price (USDC)</label>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          placeholder="0.00 = Free"
                          value={sec.price}
                          onChange={(e) => updateSection(idx, 'price', e.target.value)}
                        />
                      </div>
                    </div>
                    {sections.length > 1 && (
                      <button className="btn btn-ghost btn-icon remove-section-btn" onClick={() => removeSection(idx)} aria-label="Remove section">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                <button className="btn btn-secondary btn-sm" onClick={addSection} id="add-section-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                  </svg>
                  Add Section
                </button>
              </div>

              <div className="publish-form-actions">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" onClick={handleBuildTree} id="build-tree-btn">
                  Build Merkle Tree
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Anchor On-Chain */}
          {step === 3 && (
            <div className="publish-card card fade-in" id="step-anchor">
              <h2 className="heading-md">Anchor On-Chain</h2>
              <p className="text-sm">The Merkle root has been computed from your document lines. Submit it to the Anchor Contract on Sepolia to make it tamper-proof.</p>

              <div className="merkle-root-display">
                <div className="text-xs">Computed Merkle Root</div>
                <code className="merkle-root-hash text-mono">{merkleRoot}</code>
                <div className="merkle-meta">
                  <span className="badge">{lines.length} leaves</span>
                  <span className="badge">~{Math.ceil(Math.log2(lines.length))} levels deep</span>
                  <span className="badge">{sections.filter(s => s.name).length} sections</span>
                </div>
              </div>

              {!isAnchored ? (
                <button
                  className={`btn btn-primary btn-lg ${isAnchoring ? 'btn-loading' : ''}`}
                  onClick={handleAnchor}
                  disabled={isAnchoring}
                  id="anchor-btn"
                >
                  {isAnchoring ? (
                    <>
                      <span className="spinner" />
                      Submitting to Sepolia...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinejoin="round"/>
                      </svg>
                      Anchor Root On-Chain
                    </>
                  )}
                </button>
              ) : (
                <div className="anchor-success" id="anchor-success">
                  <div className="anchor-success-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <h3 className="heading-sm">Document Anchored Successfully!</h3>
                  <p className="text-sm">Your document's Merkle root has been permanently recorded on Sepolia. Buyers can now verify the authenticity of any section they purchase.</p>
                  <div className="anchor-details">
                    <div className="sidebar-field">
                      <span className="text-xs">Transaction Hash</span>
                      <code className="sidebar-hash text-mono">0x7f3a8b2c...9d0e1f4a</code>
                    </div>
                    <div className="sidebar-field">
                      <span className="text-xs">Block Number</span>
                      <code className="sidebar-hash text-mono">19,847,321</code>
                    </div>
                  </div>
                  <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="btn btn-outline" id="view-etherscan">
                    View on Etherscan →
                  </a>
                </div>
              )}

              <div className="publish-form-actions">
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
