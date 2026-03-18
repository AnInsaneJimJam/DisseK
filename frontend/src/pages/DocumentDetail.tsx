import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Contract, BrowserProvider } from 'ethers';
import {
  getDocument,
  purchaseSection,
  purchaseLines,
  verifyProof,
  type DocumentListing,
  type ProofPackage,
} from '../api/marketplace';
import { useWallet } from '../context/WalletContext';
import { USDC_ADDRESS, ERC20_ABI, usdToUsdcUnits } from '../contracts/USDC';
import { MERKLE_ANCHOR_CHAIN_ID } from '../contracts/MerkleAnchor';
import './DocumentDetail.css';

interface SectionPurchaseData {
  disclosedLines: string[];
  proofPackage: ProofPackage;
  disclosureLink: string | null;
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { address: walletAddress, isConnected: walletConnected, ensName, identity, signer } = useWallet();
  const [doc, setDoc] = useState<DocumentListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [purchasedSections, setPurchasedSections] = useState<Map<string, SectionPurchaseData>>(new Map());
  const [purchasingSection, setPurchasingSection] = useState<string | null>(null);
  const [verifyingSection, setVerifyingSection] = useState<string | null>(null);
  const [verifiedSections, setVerifiedSections] = useState<Set<string>>(new Set());
  const [verifyMessages, setVerifyMessages] = useState<Map<string, string>>(new Map());

  // Line-by-line purchase state
  const [customLineStart, setCustomLineStart] = useState('');
  const [customLineEnd, setCustomLineEnd] = useState('');
  const [isPurchasingCustom, setIsPurchasingCustom] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  // ENS purchase mode
  const [purchaseMode, setPurchaseMode] = useState<'individual' | 'organization'>('individual');
  const [namespace, setNamespace] = useState('');

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

  const BACKEND_URL = "http://localhost:3001";

  const grantAccess = async (sectionIndex: number) => {
    if (!walletAddress) return;
    const grantedTo = purchaseMode === 'organization' && namespace
      ? namespace
      : (ensName || identity?.ensName || walletAddress);
    try {
      await fetch(`${BACKEND_URL}/grant-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          sectionIndex,
          grantType: purchaseMode === 'organization' ? 'namespace' : 'individual',
          grantedTo,
          purchasedBy: walletAddress,
          requireEnsip25: purchaseMode === 'organization',
        }),
      });
    } catch (err) {
      console.warn('Grant access failed:', err);
    }
  };

  const handlePurchase = async (sectionId: string) => {
    if (!walletConnected || !walletAddress || !signer) {
      alert('Please connect your wallet first.');
      return;
    }
    if (!doc) return;

    const section = doc.sections.find(s => s.id === sectionId);
    if (!section) return;

    const lineCount = section.lineEnd - section.lineStart + 1;
    const totalCost = lineCount * section.pricePerLine;

    setPurchasingSection(sectionId);
    try {
      let txHash: string | undefined;

      // Send USDC payment if not free
      if (totalCost > 0 && doc.host?.signerAddress) {
        const publisherAddr = doc.host.signerAddress;
        const confirmed = window.confirm(
          `Pay $${totalCost.toFixed(2)} USDC to ${doc.host.name || publisherAddr.slice(0, 10) + '...'}?\n\n` +
          `• ${lineCount} lines × $${section.pricePerLine}/line\n` +
          `• Recipient: ${publisherAddr}\n` +
          `• Network: Sepolia\n\n` +
          `MetaMask will open next to approve the USDC transfer.`
        );
        if (!confirmed) {
          setPurchasingSection(null);
          return;
        }

        // Ensure wallet is on Sepolia (where USDC contract lives)
        setPaymentStatus('Switching to Sepolia...');
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + MERKLE_ANCHOR_CHAIN_ID.toString(16) }],
        });
        const freshProvider = new BrowserProvider((window as any).ethereum);
        const freshSigner = await freshProvider.getSigner();

        setPaymentStatus('Sending USDC payment...');
        const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, freshSigner);
        const amount = usdToUsdcUnits(totalCost);
        const tx = await usdc.transfer(publisherAddr, amount);
        txHash = tx.hash;
        setPaymentStatus('Waiting for confirmation...');
        await tx.wait(1);
        setPaymentStatus('Payment confirmed! Fetching disclosure...');
      }

      const result = await purchaseSection(
        doc.id,
        sectionId,
        walletAddress,
        txHash,
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
        // Create access grant
        const sectionIdx = doc.sections.findIndex(s => s.id === sectionId);
        if (sectionIdx >= 0) grantAccess(sectionIdx);
      }
    } catch (err: any) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        // User rejected in MetaMask — silently cancel
      } else {
        alert(`Purchase failed: ${err.message}`);
      }
    } finally {
      setPurchasingSection(null);
      setPaymentStatus(null);
    }
  };

  const handlePurchaseCustomLines = async () => {
    if (!doc) return;
    const start = parseInt(customLineStart);
    const end = parseInt(customLineEnd);
    if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= doc.totalLines) {
      alert(`Invalid range. Enter lines 0–${doc.totalLines - 1}.`);
      return;
    }
    const customKey = `custom-${start}-${end}`;
    setIsPurchasingCustom(true);
    try {
      if (!walletConnected || !walletAddress || !signer) {
        alert('Please connect your wallet first.');
        return;
      }

      const lineCount = end - start + 1;
      const totalCost = lineCount * doc.pricePerLine;
      let txHash: string | undefined;

      // Send USDC payment if not free
      if (totalCost > 0 && doc.host?.signerAddress) {
        const publisherAddr = doc.host.signerAddress;
        const confirmed = window.confirm(
          `Pay $${totalCost.toFixed(2)} USDC to ${doc.host.name || publisherAddr.slice(0, 10) + '...'}?\n\n` +
          `\u2022 ${lineCount} lines \u00d7 $${doc.pricePerLine}/line\n` +
          `\u2022 Recipient: ${publisherAddr}\n` +
          `\u2022 Network: Sepolia\n\n` +
          `MetaMask will open next to approve the USDC transfer.`
        );
        if (!confirmed) {
          setIsPurchasingCustom(false);
          return;
        }

        // Ensure wallet is on Sepolia (where USDC contract lives)
        setPaymentStatus('Switching to Sepolia...');
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + MERKLE_ANCHOR_CHAIN_ID.toString(16) }],
        });
        const freshProvider = new BrowserProvider((window as any).ethereum);
        const freshSigner = await freshProvider.getSigner();

        setPaymentStatus('Sending USDC payment...');
        const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, freshSigner);
        const amount = usdToUsdcUnits(totalCost);
        const tx = await usdc.transfer(publisherAddr, amount);
        txHash = tx.hash;
        setPaymentStatus('Waiting for confirmation...');
        await tx.wait(1);
        setPaymentStatus('Payment confirmed! Fetching disclosure...');
      }

      const result = await purchaseLines(doc.id, start, end, walletAddress, txHash);
      if (result.proofPackage) {
        setPurchasedSections((prev) => {
          const next = new Map(prev);
          next.set(customKey, {
            disclosedLines: result.disclosedLines || [],
            proofPackage: result.proofPackage,
            disclosureLink: result.disclosureLink,
          });
          return next;
        });
      }
    } catch (err: any) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        // User rejected in MetaMask — silently cancel
      } else {
        alert(`Purchase failed: ${err.message}`);
      }
    } finally {
      setIsPurchasingCustom(false);
      setPaymentStatus(null);
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
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
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
                  <span className="doc-detail-author-name">{doc.host?.ensName || hostName}</span>
                  <span className="doc-detail-author-addr text-mono">
                    {doc.host?.signerAddress
                      ? `${doc.host.signerAddress.slice(0, 6)}...${doc.host.signerAddress.slice(-4)}`
                      : doc.host?.trustModel === 'institution'
                        ? doc.host.institution
                        : `Reputation: ${doc.host?.reputation ?? 0}/100`}
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
                    <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                  </svg>
                  {doc.totalLines} lines · {doc.sections.length} sections
                </span>
                <span className="text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Identity & Purchase Mode Panel */}
            {walletConnected && (
              <div className="identity-panel card fade-in" id="identity-panel">
                <div className="identity-info">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Purchasing as</span>
                  <span className="text-sm" style={{ fontWeight: 600 }}>
                    {ensName || identity?.ensName || `${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}`}
                  </span>
                  {identity?.identityType === 'org-agent' && identity.parentName && (
                    <span className="identity-badge">🏢 Agent under {identity.parentName}</span>
                  )}
                  {identity?.forwardVerified && (
                    <span className="identity-badge" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)' }}>✓ Verified</span>
                  )}
                </div>
                <div className="purchase-mode-toggle">
                  <button
                    className={`btn btn-sm ${purchaseMode === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPurchaseMode('individual')}
                  >
                    Individual
                  </button>
                  <button
                    className={`btn btn-sm ${purchaseMode === 'organization' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPurchaseMode('organization')}
                  >
                    Organization
                  </button>
                </div>
                {purchaseMode === 'organization' && (
                  <div className="namespace-input" style={{ marginTop: '0.5rem' }}>
                    <label className="text-xs">Namespace (parent ENS)</label>
                    <input
                      className="input"
                      placeholder="e.g. research.google.eth"
                      value={namespace}
                      onChange={e => setNamespace(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
            {!walletConnected && (
              <div className="identity-panel card fade-in" id="connect-prompt" style={{ textAlign: 'center', padding: '1.5rem' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Connect your wallet to purchase sections and build your ENS identity.
                </p>
              </div>
            )}

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
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
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
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
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
                                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
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
                                {paymentStatus || 'Purchasing...'}
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                                {section.pricePerLine === 0 ? 'Get Free Section' : `Buy for $${totalPrice.toFixed(2)} USDC`}
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
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                                </svg>
                                Verify Merkle Proof
                              </>
                            )}
                          </button>
                        )}
                        {isVerified && (
                          <div className="verification-result">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
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

              {/* Line-by-line purchase */}
              {doc.sellLineByLine && (
                <div className="custom-line-purchase card fade-in" style={{ marginTop: '1.5rem' }}>
                  <h3 className="heading-sm" style={{ marginBottom: '0.5rem' }}>Buy Any Lines</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    This document supports line-by-line purchases. Pick any range (0–{doc.totalLines - 1}) at ${doc.pricePerLine}/line.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <label className="text-xs">Start Line</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max={doc.totalLines - 1}
                        placeholder="0"
                        value={customLineStart}
                        onChange={(e) => setCustomLineStart(e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </div>
                    <span style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>–</span>
                    <div>
                      <label className="text-xs">End Line</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max={doc.totalLines - 1}
                        placeholder={String(doc.totalLines - 1)}
                        value={customLineEnd}
                        onChange={(e) => setCustomLineEnd(e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </div>
                    <button
                      className={`btn btn-primary btn-sm ${isPurchasingCustom ? 'btn-loading' : ''}`}
                      onClick={handlePurchaseCustomLines}
                      disabled={isPurchasingCustom || !customLineStart || !customLineEnd}
                    >
                      {isPurchasingCustom ? (
                        <><span className="spinner" /> Purchasing...</>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                          Buy Lines
                        </>
                      )}
                    </button>
                    {customLineStart && customLineEnd && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        = ${((parseInt(customLineEnd) - parseInt(customLineStart) + 1) * doc.pricePerLine).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Show custom purchased ranges */}
                  {Array.from(purchasedSections.entries())
                    .filter(([key]) => key.startsWith('custom-'))
                    .map(([key, data]) => {
                      const match = key.match(/^custom-(\d+)-(\d+)$/);
                      const cStart = match ? parseInt(match[1]) : 0;
                      const cEnd = match ? parseInt(match[2]) : 0;
                      const isVerified = verifiedSections.has(key);
                      const isVerifying = verifyingSection === key;

                      return (
                        <div key={key} className={`section-item card ${isVerified ? 'verified' : 'purchased'}`} style={{ marginTop: '1rem' }}>
                          <div className="section-item-header">
                            <div className="section-item-info">
                              <h3>Lines {cStart}–{cEnd}</h3>
                              <span className="section-item-range text-mono text-xs">Custom range · {cEnd - cStart + 1} lines</span>
                            </div>
                          </div>
                          <div className="section-item-content">
                            <div className="section-content-box">
                              <div className="section-content-label text-xs">
                                Content Unlocked — {data.disclosedLines.length} lines with Merkle proof
                              </div>
                              <div className="extracted-lines" style={{ maxHeight: '200px', marginTop: '0.5rem' }}>
                                {data.disclosedLines.map((line, i) => (
                                  <div key={i} className="extracted-line">
                                    <span className="line-num text-mono">{cStart + i}</span>
                                    <span className="line-content text-sm">{line || <span style={{ color: 'var(--text-muted)' }}>(empty)</span>}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="section-item-actions">
                            {!isVerified && (
                              <button
                                className={`btn btn-outline btn-sm ${isVerifying ? 'verifying' : ''}`}
                                onClick={() => handleVerify(key)}
                                disabled={isVerifying}
                              >
                                {isVerifying ? <><span className="spinner" /> Verifying...</> : 'Verify Merkle Proof'}
                              </button>
                            )}
                            {isVerified && (
                              <div className="verification-result">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                                </svg>
                                <span>Lines {cStart}–{cEnd} verified against root <code>{doc.merkleRoot.slice(0, 16)}...</code></span>
                              </div>
                            )}
                            {verifyMessages.has(key) && !isVerified && (
                              <p className="text-xs" style={{ color: 'var(--error)', marginTop: '0.5rem' }}>
                                {verifyMessages.get(key)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
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
              <h4 className="heading-sm">Host Identity</h4>
              <div className="sidebar-field">
                <span className="text-xs">Name</span>
                <span className="text-sm">{hostName}</span>
              </div>
              {doc.host?.ensName && (
                <div className="sidebar-field">
                  <span className="text-xs">ENS</span>
                  <span className="text-sm" style={{ color: 'var(--accent-violet)' }}>{doc.host.ensName}</span>
                </div>
              )}
              {doc.host?.signerAddress && (
                <div className="sidebar-field">
                  <span className="text-xs">Signer</span>
                  <code className="sidebar-hash text-mono">{doc.host.signerAddress}</code>
                </div>
              )}
              <div className="sidebar-field">
                <span className="text-xs">Trust Model</span>
                <span className="badge" style={{ fontSize: '0.7rem' }}>
                  {doc.host?.trustModel === 'institution' ? `🏛 ${doc.host.institution}` : '👤 Reputation'}
                </span>
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
              {doc.anchorTx && (
                <div className="sidebar-field">
                  <span className="text-xs">On-Chain Anchor</span>
                  <a
                    href={`https://${doc.anchorChain === 'sepolia' ? 'sepolia.' : ''}etherscan.io/tx/${doc.anchorTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm"
                    style={{ color: 'var(--accent-violet)', textDecoration: 'underline', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}
                  >
                    {doc.anchorTx.slice(0, 10)}...{doc.anchorTx.slice(-8)} ↗
                  </a>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
