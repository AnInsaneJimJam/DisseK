import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getDocument,
  purchaseSection,
  verifyProof,
  type DocumentListing,
  type ProofPackage,
} from '../api/marketplace';
import './DocumentDetail.css';

interface SectionPurchaseData {
  disclosedLines: string[];
  proofPackage: ProofPackage;
  disclosureLink: string | null;
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<DocumentListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [purchasedSections, setPurchasedSections] = useState<Map<string, SectionPurchaseData>>(new Map());
  const [purchasingSection, setPurchasingSection] = useState<string | null>(null);
  const [verifyingSection, setVerifyingSection] = useState<string | null>(null);
  const [verifiedSections, setVerifiedSections] = useState<Set<string>>(new Set());
  const [verifyMessages, setVerifyMessages] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDocument(id)
      .then(setDoc)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="not-found-page">
        <div className="container">
          <h1 className="heading-lg">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!doc || error) {
    return (
      <div className="not-found-page">
        <div className="container">
          <h1 className="heading-lg">Document not found</h1>
          <p className="text-body">{error || "The document you're looking for doesn't exist."}</p>
          <Link to="/marketplace" className="btn btn-primary" id="back-to-marketplace">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const hostName = doc.host?.name || 'Unknown Host';

  const handlePurchase = async (sectionId: string) => {
    setPurchasingSection(sectionId);
    try {
      const result = await purchaseSection(
        doc.id,
        sectionId,
        '0xBuyerAddress' // In production: from wallet
      );
      if (result.proofPackage) {
        setPurchasedSections((prev) => {
          const next = new Map(prev);
          next.set(sectionId, {
            disclosedLines: result.disclosedLines || [],
            proofPackage: result.proofPackage,
            disclosureLink: result.disclosureLink,
          });
          return next;
        });
      }
    } catch (err: any) {
      alert(`Purchase failed: ${err.message}`);
    } finally {
      setPurchasingSection(null);
    }
  };

  const handleVerify = async (sectionId: string) => {
    const data = purchasedSections.get(sectionId);
    if (!data) return;

    setVerifyingSection(sectionId);
    try {
      const result = await verifyProof(
        data.disclosedLines,
        data.proofPackage,
        doc.id
      );
      if (result.verified) {
        setVerifiedSections((prev) => new Set([...prev, sectionId]));
      }
      setVerifyMessages((prev) => {
        const next = new Map(prev);
        next.set(sectionId, result.message);
        return next;
      });
    } catch (err: any) {
      setVerifyMessages((prev) => {
        const next = new Map(prev);
        next.set(sectionId, `Verification error: ${err.message}`);
        return next;
      });
    } finally {
      setVerifyingSection(null);
    }
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
                  {hostName.charAt(0)}
                </div>
                <div>
                  <span className="doc-detail-author-name">{hostName}</span>
                  <span className="doc-detail-author-addr text-mono">
                    {doc.host?.trustModel === 'institution' ? doc.host.institution : `Reputation: ${doc.host?.reputation ?? 0}/100`}
                  </span>
                </div>
              </div>

              <h1 className="heading-lg">{doc.title}</h1>
              <p className="text-body">{doc.description}</p>

              <div className="doc-detail-tags">
                {doc.tags.map(tag => (
                  <span key={tag} className="badge">{tag}</span>
                ))}
                <span className={`badge ${doc.host?.trustModel === 'institution' ? 'badge-success' : ''}`}>
                  {doc.host?.trustModel === 'institution' ? 'Institution Signed' : 'Reputation Based'}
                </span>
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
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Sections */}
            <div className="doc-sections" id="doc-sections">
              <h2 className="heading-md">Sections</h2>
              <div className="sections-list">
                {doc.sections.map((section, idx) => {
                  const isPurchased = purchasedSections.has(section.id);
                  const isVerified = verifiedSections.has(section.id);
                  const isVerifying = verifyingSection === section.id;
                  const isPurchasing = purchasingSection === section.id;
                  const lineCount = section.lineEnd - section.lineStart + 1;
                  const totalPrice = lineCount * section.pricePerLine;

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
                            Lines {section.lineStart}–{section.lineEnd} ({lineCount} lines)
                          </span>
                        </div>
                        <div className="section-item-price">
                          {section.pricePerLine === 0 ? (
                            <span className="price price-free">Free</span>
                          ) : (
                            <span className="price">${totalPrice.toFixed(2)} (${section.pricePerLine}/line)</span>
                          )}
                        </div>
                      </div>

                      <p className="section-item-preview text-sm">{section.description}</p>

                      {isPurchased && purchasedSections.get(section.id) && (
                        <div className="section-item-content">
                          <div className="section-content-box">
                            <div className="section-content-label text-xs">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                              </svg>
                              Content Unlocked — {purchasedSections.get(section.id)!.disclosedLines.length} lines delivered with Merkle proof
                            </div>
                            <div className="extracted-lines" style={{ maxHeight: '200px', marginTop: '0.5rem' }}>
                              {purchasedSections.get(section.id)!.disclosedLines.map((line, i) => (
                                <div key={i} className="extracted-line">
                                  <span className="line-num text-mono">{section.lineStart + i}</span>
                                  <span className="line-content text-sm">{line || <span style={{ color: 'var(--text-muted)' }}>(empty)</span>}</span>
                                </div>
                              ))}
                            </div>
                            {purchasedSections.get(section.id)!.disclosureLink && (
                              <a
                                href={purchasedSections.get(section.id)!.disclosureLink!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ marginTop: '0.75rem' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                View on Fileverse
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="section-item-actions">
                        {!isPurchased && (
                          <button
                            className={`btn btn-primary btn-sm ${isPurchasing ? 'btn-loading' : ''}`}
                            onClick={() => handlePurchase(section.id)}
                            disabled={isPurchasing}
                            id={`buy-${section.id}`}
                          >
                            {isPurchasing ? (
                              <>
                                <span className="spinner" />
                                Purchasing...
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                                </svg>
                                {section.pricePerLine === 0 ? 'Get Free Section' : `Buy for $${totalPrice.toFixed(2)}`}
                              </>
                            )}
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
                            <span>Lines {section.lineStart}–{section.lineEnd} verified against root <code>{doc.merkleRoot.slice(0, 16)}...</code></span>
                          </div>
                        )}
                        {verifyMessages.has(section.id) && !isVerified && (
                          <p className="text-xs" style={{ color: 'var(--error)', marginTop: '0.5rem' }}>
                            {verifyMessages.get(section.id)}
                          </p>
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
              {doc.anchorTx && (
                <div className="sidebar-field">
                  <span className="text-xs">Anchor Tx</span>
                  <code className="sidebar-hash text-mono">{doc.anchorTx}</code>
                </div>
              )}
              <div className="sidebar-field">
                <span className="text-xs">Network</span>
                <span className="badge badge-violet">{doc.anchorChain || 'Sepolia'}</span>
              </div>
              {doc.merkleRoot && (
                <div className="sidebar-verified">
                  <span className="verified-dot" />
                  Root anchored on-chain
                </div>
              )}
            </div>

            <div className="sidebar-card card" id="sidebar-host-info">
              <h4 className="heading-sm">Host Info</h4>
              <div className="sidebar-field">
                <span className="text-xs">Name</span>
                <span className="text-sm">{hostName}</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Trust Model</span>
                <span className="text-sm">{doc.host?.trustModel === 'institution' ? `Institution: ${doc.host.institution}` : 'Reputation Based'}</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Reputation Score</span>
                <span className="text-sm">{doc.host?.reputation ?? 0}/100</span>
              </div>
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
                <span className="text-sm">~{doc.totalLines > 0 ? Math.ceil(Math.log2(doc.totalLines)) : 0} levels</span>
              </div>
              <div className="sidebar-field">
                <span className="text-xs">Verification</span>
                <span className="text-sm">Server-side (Rust WASM)</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
