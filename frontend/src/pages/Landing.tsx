import { Link } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero" id="hero-section">
        <div className="container hero-container">
          <div className="hero-badge fade-in">
            <span className="hero-badge-dot" />
            Built for EthMumbai 2026 · Powered by Fileverse
          </div>

          <h1 className="hero-title heading-xl fade-in stagger-1">
            Sell Knowledge.<br />
            <span className="hero-title-accent">Not Documents.</span>
          </h1>

          <p className="hero-subtitle fade-in stagger-2">
            Monetize specific sections of your documents with cryptographic proof of authenticity.
            Buyers receive Merkle inclusion proofs — no trust required.
          </p>

          <div className="hero-actions fade-in stagger-3">
            <Link to="/marketplace" className="btn btn-primary btn-lg" id="hero-cta-explore">
              Explore Marketplace
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link to="/publish" className="btn btn-secondary btn-lg" id="hero-cta-publish">
              Publish a Document
            </Link>
          </div>

          <div className="hero-stats fade-in stagger-4">
            <div className="hero-stat">
              <span className="hero-stat-value">127</span>
              <span className="hero-stat-label">Documents</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">3,400+</span>
              <span className="hero-stat-label">Sections Sold</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">$12.4k</span>
              <span className="hero-stat-label">Revenue Generated</span>
            </div>
          </div>
        </div>

        {/* Hero background decoration */}
        <div className="hero-glow" />
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="how-it-works-section">
        <div className="container">
          <div className="section-header fade-in">
            <span className="section-label">How It Works</span>
            <h2 className="heading-lg">Three steps to verified knowledge</h2>
            <p className="text-body">
              From document to monetised sections with cryptographic provenance — fully on-chain.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card fade-in stagger-1" id="step-publish">
              <div className="step-number">01</div>
              <div className="step-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="heading-sm">Publish & Define</h3>
              <p className="text-sm">
                Import your Fileverse document. Define named sections with line ranges and set prices in USDC. The Merkle root is anchored on-chain as a tamper-proof fingerprint.
              </p>
            </div>

            <div className="step-connector">
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line x1="0" y1="1" x2="40" y2="1" stroke="var(--border-hover)" strokeWidth="1" strokeDasharray="4 4"/>
              </svg>
            </div>

            <div className="step-card fade-in stagger-2" id="step-purchase">
              <div className="step-number">02</div>
              <div className="step-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="heading-sm">Purchase via x402</h3>
              <p className="text-sm">
                Browse sections and pay with autonomous micropayments. AI agents pay via x402 protocol — no human intervention needed. ENS identity verifies namespace access.
              </p>
            </div>

            <div className="step-connector">
              <svg width="40" height="2" viewBox="0 0 40 2">
                <line x1="0" y1="1" x2="40" y2="1" stroke="var(--border-hover)" strokeWidth="1" strokeDasharray="4 4"/>
              </svg>
            </div>

            <div className="step-card fade-in stagger-3" id="step-verify">
              <div className="step-number">03</div>
              <div className="step-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                </svg>
              </div>
              <h3 className="heading-sm">Verify & Use</h3>
              <p className="text-sm">
                Receive content with a Merkle inclusion proof. Rust WASM verifies in your browser — the recomputed root must match the on-chain anchor. Math is the guarantee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features-section">
        <div className="container">
          <div className="section-header fade-in">
            <span className="section-label">Core Technology</span>
            <h2 className="heading-lg">Built on cryptographic primitives</h2>
          </div>

          <div className="features-grid">
            <div className="feature-card card fade-in stagger-1" id="feature-merkle">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.5">
                  <path d="M12 2l10 6v8l-10 6L2 16V8l10-6z" strokeLinejoin="round"/>
                  <path d="M12 22V12M2 8l10 4 10-4" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>SHA256 Merkle Trees</h3>
              <p>Every line is a leaf. The root is your document fingerprint. Range proofs are O(log n) — verify 80 lines as efficiently as 1.</p>
            </div>

            <div className="feature-card card fade-in stagger-2" id="feature-wasm">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-indigo)" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="18" rx="3"/>
                  <path d="M8 12h8M8 8h5M8 16h6" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Rust → WASM</h3>
              <p>Merkle proofs run in the browser via WebAssembly. No backend prover, no server round-trip. Compiled from Rust for correctness and speed.</p>
            </div>

            <div className="feature-card card fade-in stagger-3" id="feature-ens">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>ENSIP-25 Identity</h3>
              <p>AI agents prove organisational membership via ENS reverse lookup. Grant access to entire namespaces — not individual addresses.</p>
            </div>

            <div className="feature-card card fade-in stagger-4" id="feature-x402">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5">
                  <path d="M12 1v4M12 19v4M4 12H1M23 12h-3M18.364 5.636l-2.121 2.121M7.757 16.243l-2.121 2.121M18.364 18.364l-2.121-2.121M7.757 7.757L5.636 5.636" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
              </div>
              <h3>x402 Protocol</h3>
              <p>Machine-readable HTTP micropayments. HTTP 402 → pay → retry → content. Fully autonomous for AI agents, wallet popup for humans.</p>
            </div>

            <div className="feature-card card fade-in stagger-5" id="feature-fileverse">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round"/>
                  <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Fileverse Integration</h3>
              <p>End-to-end encrypted documents on IPFS. Content extracted from ProseMirror DOM after client-side decryption — no keys leaked.</p>
            </div>

            <div className="feature-card card fade-in stagger-5" id="feature-onchain">
              <div className="feature-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>On-Chain Anchoring</h3>
              <p>Merkle roots stored immutably on Sepolia. Any proof can be verified on-chain forever — trustless, permissionless, permanent.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="cta-section">
        <div className="container">
          <div className="cta-card fade-in">
            <div className="cta-content">
              <h2 className="heading-lg">Ready to monetise your knowledge?</h2>
              <p className="text-body">
                Publish your first document and start earning from every section — with cryptographic guarantees for your buyers.
              </p>
              <div className="cta-actions">
                <Link to="/publish" className="btn btn-primary btn-lg" id="cta-start-publishing">
                  Start Publishing
                </Link>
                <Link to="/marketplace" className="btn btn-ghost btn-lg" id="cta-browse">
                  Browse Documents →
                </Link>
              </div>
            </div>
            <div className="cta-glow" />
          </div>
        </div>
      </section>
    </div>
  );
}
