import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MOCK_DOCUMENTS } from '../data/mockData';
import './DocumentDetail.css';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const doc = MOCK_DOCUMENTS.find(d => d.id === id);
  const [purchasedSections, setPurchasedSections] = useState<Set<string>>(new Set());
  const [verifyingSection, setVerifyingSection] = useState<string | null>(null);
  const [verifiedSections, setVerifiedSections] = useState<Set<string>>(new Set());

  if (!doc) {
    return (
      <div className="not-found-page">
        <div className="container">
          <h1 className="heading-lg">Document not found</h1>
          <p className="text-body">The document you're looking for doesn't exist.</p>
          <Link to="/marketplace" className="btn btn-primary" id="back-to-marketplace">
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const handlePurchase = (sectionId: string) => {
    // Simulate x402 payment flow
    setPurchasedSections(prev => new Set([...prev, sectionId]));
  };

  const handleVerify = (sectionId: string) => {
    setVerifyingSection(sectionId);
    // Simulate WASM Merkle proof verification
    setTimeout(() => {
      setVerifiedSections(prev => new Set([...prev, sectionId]));
      setVerifyingSection(null);
    }, 1500);
  };

  return (
    <div className="doc-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb fade-in" id="doc-breadcrumb">
          <Link to="/marketplace" className="breadcrumb-link">Marketplace</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="breadcrumb-current">{doc.title}</span>
        </div>

        <div className="doc-detail-layout">
          {/* Main Content */}
          <div className="doc-detail-main">
            {/* Header */}
            <div className="doc-detail-header fade-in" id="doc-header">
              <div className="doc-detail-author-row">
                <div className="doc-detail-avatar" style={{ background: `linear-gradient(135deg, hsl(${(doc.title.length * 37) % 360}, 60%, 50%), hsl(${(doc.title.length * 37 + 40) % 360}, 70%, 40%))` }}>
                  {doc.author.charAt(0)}
                </div>
                <div>
                  <span className="doc-detail-author-name">{doc.author}</span>
                  <span className="doc-detail-author-addr text-mono">{doc.authorAddress}</span>
                </div>
              </div>

              <h1 className="heading-lg">{doc.title}</h1>
              <p className="text-body">{doc.description}</p>

              <div className="doc-detail-tags">
                {doc.tags.map(tag => (
                  <span key={tag} className="badge">{tag}</span>
                ))}
              </div>

              <div className="doc-detail-meta">
                <span className="text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round"/>
                  </svg>
                  {doc.totalLines} lines · {doc.sections.length} sections
                </span>
                <span className="text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                  {doc.purchases} purchases
                </span>
                <span className="text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {doc.createdAt}
                </span>
              </div>
            </div>

            {/* Sections */}
            <div className="doc-sections" id="doc-sections">
              <h2 className="heading-md">Sections</h2>
              <div className="sections-list">
                {doc.sections.map((section, idx) => {
                  const isPurchased = section.isFree || purchasedSections.has(section.id);
                  const isVerified = verifiedSections.has(section.id);
                  const isVerifying = verifyingSection === section.id;

                  return (
                    <div
                      key={section.id}
                      className={`section-item card fade-in stagger-${Math.min(idx + 1, 5)} ${isPurchased ? 'purchased' : ''} ${isVerified ? 'verified' : ''}`}
                      id={`section-${section.id}`}
                    >
                      <div className="section-item-header">
                        <div className="section-item-info">
                          <div className="section-item-name-row">
                            <h3>{section.name}</h3>
                            {isVerified && (
                              <span className="verified-badge">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                                  <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                                </svg>
                                Verified
                              </span>
                            )}
                          </div>
                          <span className="section-item-range text-mono text-xs">
                            Lines {section.lineStart}–{section.lineEnd}
                          </span>
                        </div>
                        <div className="section-item-price">
                          {section.isFree ? (
                            <span className="price price-free">Free</span>
                          ) : (
                            <span className="price">{section.price} {section.currency}</span>
                          )}
                        </div>
                      </div>

                      <p className="section-item-preview text-sm">{section.preview}</p>

                      {isPurchased && (
                        <div className="section-item-content">
                          <div className="section-content-box">
                            <div className="section-content-label text-xs">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                              </svg>
                              Content Unlocked
                            </div>
                            <p className="text-sm">{section.preview} <span className="text-muted">[Simulated content — full lines would be delivered via x402 proof bundle]</span></p>
                          </div>
                        </div>
                      )}

                      <div className="section-item-actions">
                        {!isPurchased && !section.isFree && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePurchase(section.id)}
                            id={`buy-${section.id}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0110 0v4"/>
                            </svg>
                            Purchase via x402
                          </button>
                        )}
                        {isPurchased && !isVerified && (
                          <button
                            className={`btn btn-outline btn-sm ${isVerifying ? 'verifying' : ''}`}
                            onClick={() => handleVerify(section.id)}
                            disabled={isVerifying}
                            id={`verify-${section.id}`}
                          >
                            {isVerifying ? (
                              <>
                                <span className="spinner" />
                                Verifying proof...
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                                  <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                                </svg>
                                Verify Merkle Proof
                              </>
                            )}
                          </button>
                        )}
                        {isVerified && (
                          <div className="verification-result">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                              <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                            </svg>
                            <span>Lines {section.lineStart}–{section.lineEnd} verified against root <code>{doc.merkleRoot}</code></span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="doc-detail-sidebar fade-in stagger-2">
            <div className="sidebar-card card" id="sidebar-anchor-info">
              <h4 className="heading-sm">On-Chain Anchor</h4>
              <div className="sidebar-field">
                <span className="text-xs">Merkle Root</span>
                <code className="sidebar-hash text-mono">{doc.merkleRoot}</code>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Anchor Tx</span>
                <code className="sidebar-hash text-mono">{doc.anchorTx}</code>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Network</span>
                <span className="badge badge-violet">Sepolia</span>
              </div>
              {doc.verified && (
                <div className="sidebar-verified">
                  <span className="verified-dot" />
                  Root anchored on-chain
                </div>
              )}
            </div>

            <div className="sidebar-card card" id="sidebar-proof-info">
              <h4 className="heading-sm">Proof Details</h4>
              <div className="sidebar-field">
                <span className="text-xs">Proof Type</span>
                <span className="text-sm">SHA256 Merkle Range Proof</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Tree Leaves</span>
                <span className="text-sm">{doc.totalLines} (one per line)</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Tree Depth</span>
                <span className="text-sm">~{Math.ceil(Math.log2(doc.totalLines))} levels</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Verification</span>
                <span className="text-sm">Browser (Rust WASM)</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
