import { useState } from 'react';
import {
  registerHost,
  createDocumentListing,
  checkHostHealth,
  listHostDocuments,
  getHostDocument,
  buildMerkleTree,
  type FileverseDoc,
} from '../api/marketplace';
import './Publish.css';

interface SectionDef {
  name: string;
  lineStart: string;
  lineEnd: string;
  pricePerLine: string;
  description: string;
}

interface FvDocSummary {
  ddocId: string;
  title: string;
  syncStatus: string;
}

export default function Publish() {
  const [step, setStep] = useState(1);

  // Step 1: Host info + connect
  const [hostBackendUrl, setHostBackendUrl] = useState('http://localhost:3001');
  const [hostName, setHostName] = useState('');
  const [trustModel, setTrustModel] = useState<'reputation' | 'institution'>('reputation');
  const [institution, setInstitution] = useState('');
  const [hostDescription, setHostDescription] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [hostConnected, setHostConnected] = useState(false);

  // Step 1b: Document selection from Fileverse
  const [fvDocs, setFvDocs] = useState<FvDocSummary[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDdocId, setSelectedDdocId] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<FileverseDoc | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  // Step 2: Document metadata + sections
  const [docDescription, setDocDescription] = useState('');
  const [docTags, setDocTags] = useState('');
  const [sections, setSections] = useState<SectionDef[]>([
    { name: '', lineStart: '', lineEnd: '', pricePerLine: '1', description: '' },
  ]);

  // Step 3: Build tree + list
  const [merkleRoot, setMerkleRoot] = useState('');
  const [totalLeaves, setTotalLeaves] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [listingResult, setListingResult] = useState<{ docId: string } | null>(null);
  const [hostId, setHostId] = useState('');
  const [error, setError] = useState('');

  // Connect to host backend and load Fileverse documents
  const handleConnect = async () => {
    setIsConnecting(true);
    setError('');
    try {
      await checkHostHealth(hostBackendUrl);
      setHostConnected(true);

      // Fetch documents from the host's Fileverse instance
      setIsLoadingDocs(true);
      const result = await listHostDocuments(hostBackendUrl, 50);
      setFvDocs(result.ddocs.map((d) => ({
        ddocId: d.ddocId,
        title: d.title || `Untitled (${d.ddocId.slice(0, 8)}...)`,
        syncStatus: d.syncStatus,
      })));
    } catch (err: any) {
      setError(`Cannot connect to host backend: ${err.message}. Is it running at ${hostBackendUrl}?`);
    } finally {
      setIsConnecting(false);
      setIsLoadingDocs(false);
    }
  };

  // Select a document and fetch its full content
  const handleSelectDoc = async (ddocId: string) => {
    setSelectedDdocId(ddocId);
    setIsLoadingDoc(true);
    setError('');
    try {
      const doc = await getHostDocument(hostBackendUrl, ddocId);
      setSelectedDoc(doc);
    } catch (err: any) {
      setError(`Failed to fetch document: ${err.message}`);
      setSelectedDoc(null);
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleProceedToSections = () => {
    if (!selectedDoc || !hostName) return;
    setStep(2);
  };

  const addSection = () => {
    setSections([...sections, { name: '', lineStart: '', lineEnd: '', pricePerLine: '1', description: '' }]);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: keyof SectionDef, value: string) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: value };
    setSections(updated);
  };

  // Build Merkle tree via host backend
  const handleBuildTree = async () => {
    if (!selectedDdocId) return;
    setIsBuilding(true);
    setError('');
    try {
      const result = await buildMerkleTree(hostBackendUrl, selectedDdocId);
      setMerkleRoot(result.merkleRoot);
      setTotalLeaves(result.totalLeaves);
      setStep(3);
    } catch (err: any) {
      setError(`Failed to build Merkle tree: ${err.message}`);
    } finally {
      setIsBuilding(false);
    }
  };

  // Register host + list document on marketplace
  const handleListOnMarketplace = async () => {
    if (!selectedDoc) return;
    setIsListing(true);
    setError('');
    try {
      const host = await registerHost({
        name: hostName,
        backendUrl: hostBackendUrl,
        description: hostDescription,
        trustModel,
        institution: trustModel === 'institution' ? institution : undefined,
      });
      setHostId(host.id);

      const doc = await createDocumentListing({
        hostId: host.id,
        ddocId: selectedDdocId,
        title: selectedDoc.title,
        description: docDescription,
        tags: docTags.split(',').map((t) => t.trim()).filter(Boolean),
        totalLines: selectedDoc.lineCount,
        merkleRoot,
        anchorTx: '',
        anchorChain: 'sepolia',
        sections: sections
          .filter((s) => s.name)
          .map((s) => ({
            name: s.name,
            lineStart: parseInt(s.lineStart) || 0,
            lineEnd: parseInt(s.lineEnd) || selectedDoc.lineCount - 1,
            pricePerLine: parseFloat(s.pricePerLine) || 0,
            description: s.description,
          })),
      });

      setListingResult({ docId: doc.id });
    } catch (err: any) {
      setError(`Failed to list: ${err.message}`);
    } finally {
      setIsListing(false);
    }
  };

  return (
    <div className="publish-page">
      <div className="container">
        <div className="publish-header fade-in" id="publish-header">
          <h1 className="heading-lg">Publish a Document</h1>
          <p className="text-body">You host a Fileverse instance and the DisseK Merkle engine. Connect your backend, select a document, define sections, and list it on the marketplace.</p>
        </div>

        {/* Progress Steps */}
        <div className="publish-steps fade-in" id="publish-progress">
          {[
            { num: 1, label: 'Connect & Select' },
            { num: 2, label: 'Define Sections' },
            { num: 3, label: 'Build & List' },
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

        {error && (
          <div className="publish-card card" style={{ borderColor: 'var(--error)', marginBottom: '1rem' }}>
            <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>
          </div>
        )}

        <div className="publish-content">
          {/* Step 1: Connect + Select Document */}
          {step === 1 && (
            <div className="publish-card card fade-in" id="step-connect">
              <h2 className="heading-md">Host Info & Document Selection</h2>
              <p className="text-sm">You run the DisseK host backend which connects to your Fileverse instance via MCP. The original document never leaves your server.</p>

              <div className="publish-field">
                <label className="text-xs">Host Backend URL</label>
                <input
                  type="text"
                  className="input text-mono"
                  placeholder="http://localhost:3001"
                  value={hostBackendUrl}
                  onChange={(e) => setHostBackendUrl(e.target.value)}
                  disabled={hostConnected}
                  id="host-backend-url-input"
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  The URL where your DisseK host backend is running. Purchase requests from buyers will be forwarded here by the marketplace.
                </span>
              </div>

              <div className="publish-field">
                <label className="text-xs">Host Name (your org / alias)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Delphi Digital, Dr. Alice"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  id="host-name-input"
                />
              </div>

              <div className="publish-field">
                <label className="text-xs">Trust Model</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn btn-sm ${trustModel === 'reputation' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setTrustModel('reputation')}
                  >
                    Reputation
                  </button>
                  <button
                    className={`btn btn-sm ${trustModel === 'institution' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setTrustModel('institution')}
                  >
                    Institution Signed
                  </button>
                </div>
              </div>

              {trustModel === 'institution' && (
                <div className="publish-field">
                  <label className="text-xs">Institution Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Johns Hopkins Hospital"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  />
                </div>
              )}

              <div className="publish-field">
                <label className="text-xs">Host Description</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Brief description of your organization"
                  value={hostDescription}
                  onChange={(e) => setHostDescription(e.target.value)}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

              {/* Connect to backend */}
              {!hostConnected ? (
                <div>
                  <button
                    className={`btn btn-primary ${isConnecting ? 'btn-loading' : ''}`}
                    onClick={handleConnect}
                    disabled={isConnecting || !hostName || !hostBackendUrl}
                    id="connect-btn"
                  >
                    {isConnecting ? (
                      <>
                        <span className="spinner" />
                        Connecting to host backend...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinejoin="round"/>
                        </svg>
                        Connect to Host Backend
                      </>
                    )}
                  </button>
                  <div className="publish-info-box" style={{ marginTop: '1rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 16v-4M12 8h.01" strokeLinecap="round"/>
                    </svg>
                    <span className="text-xs">
                      Make sure your DisseK host backend is running at the URL above. It connects to your Fileverse instance via MCP and runs the Merkle proof engine. Each host configures their own <code>FILEVERSE_API_URL</code> in the backend's <code>.env</code> file.
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                    </svg>
                    <span className="text-sm" style={{ color: 'var(--success)' }}>Connected to host backend</span>
                  </div>

                  {/* Document list from Fileverse */}
                  <div className="publish-field">
                    <label className="text-xs">Select a Fileverse Document</label>
                    {isLoadingDocs ? (
                      <p className="text-sm">Loading documents from Fileverse...</p>
                    ) : fvDocs.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No documents found on this Fileverse instance.</p>
                    ) : (
                      <div className="extracted-lines" style={{ maxHeight: '240px' }}>
                        {fvDocs.map((d) => (
                          <div
                            key={d.ddocId}
                            className={`extracted-line ${selectedDdocId === d.ddocId ? 'purchased' : ''}`}
                            style={{ cursor: 'pointer', padding: '0.5rem 0.75rem' }}
                            onClick={() => handleSelectDoc(d.ddocId)}
                          >
                            <span className="line-num text-mono" style={{ minWidth: '1.5rem' }}>
                              {selectedDdocId === d.ddocId ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="2">
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                </svg>
                              )}
                            </span>
                            <span className="line-content text-sm">{d.title}</span>
                            <span className="badge" style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>{d.syncStatus}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected document preview */}
                  {isLoadingDoc && (
                    <p className="text-sm" style={{ marginTop: '0.75rem' }}>Loading document content...</p>
                  )}
                  {selectedDoc && !isLoadingDoc && (
                    <div style={{ marginTop: '1rem' }}>
                      <div className="extracted-preview">
                        <div className="extracted-preview-header">
                          <span className="text-xs">{selectedDoc.title}</span>
                          <span className="badge badge-success">{selectedDoc.lineCount} lines</span>
                        </div>
                        <div className="extracted-lines" style={{ maxHeight: '200px' }}>
                          {selectedDoc.lines.slice(0, 50).map((line, i) => (
                            <div key={i} className="extracted-line">
                              <span className="line-num text-mono">{i}</span>
                              <span className="line-content text-sm">{line || <span style={{ color: 'var(--text-muted)' }}>(empty)</span>}</span>
                            </div>
                          ))}
                          {selectedDoc.lineCount > 50 && (
                            <div className="extracted-line" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                              <span className="text-xs">... and {selectedDoc.lineCount - 50} more lines</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={handleProceedToSections}
                        disabled={!hostName}
                        style={{ marginTop: '1rem' }}
                        id="proceed-btn"
                      >
                        Define Sections
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Define Sections */}
          {step === 2 && selectedDoc && (
            <div className="publish-card card fade-in" id="step-define">
              <h2 className="heading-md">Define Sections & Pricing</h2>
              <p className="text-sm">
                <strong>{selectedDoc.title}</strong> — {selectedDoc.lineCount} lines.
                Define sections by line range and set per-line pricing. Buyers purchase line ranges and receive Merkle proofs.
              </p>

              <div className="publish-field">
                <label className="text-xs">Document Description (visible to buyers)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Brief summary of what this document contains"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                />
              </div>

              <div className="publish-field">
                <label className="text-xs">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="DeFi, Research, Medical"
                  value={docTags}
                  onChange={(e) => setDocTags(e.target.value)}
                />
              </div>

              <div className="extracted-preview">
                <div className="extracted-preview-header">
                  <span className="text-xs">Document Content</span>
                  <span className="badge badge-success">{selectedDoc.lineCount} lines</span>
                </div>
                <div className="extracted-lines" style={{ maxHeight: '180px' }}>
                  {selectedDoc.lines.slice(0, 50).map((line, i) => (
                    <div key={i} className="extracted-line">
                      <span className="line-num text-mono">{i}</span>
                      <span className="line-content text-sm">{line || <span style={{ color: 'var(--text-muted)' }}>(empty)</span>}</span>
                    </div>
                  ))}
                  {selectedDoc.lineCount > 50 && (
                    <div className="extracted-line" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <span className="text-xs">... and {selectedDoc.lineCount - 50} more lines</span>
                    </div>
                  )}
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
                            placeholder="0"
                            value={sec.lineStart}
                            onChange={(e) => updateSection(idx, 'lineStart', e.target.value)}
                          />
                        </div>
                        <span className="range-dash">-</span>
                        <div className="publish-field">
                          <label className="text-xs">End Line</label>
                          <input
                            className="input"
                            type="number"
                            placeholder={String(selectedDoc.lineCount - 1)}
                            value={sec.lineEnd}
                            onChange={(e) => updateSection(idx, 'lineEnd', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="publish-field">
                        <label className="text-xs">Price Per Line ($)</label>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          placeholder="1.00"
                          value={sec.pricePerLine}
                          onChange={(e) => updateSection(idx, 'pricePerLine', e.target.value)}
                        />
                      </div>
                      <div className="publish-field">
                        <label className="text-xs">Section Description</label>
                        <input
                          className="input"
                          placeholder="What this section covers"
                          value={sec.description}
                          onChange={(e) => updateSection(idx, 'description', e.target.value)}
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
                <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button
                  className={`btn btn-primary ${isBuilding ? 'btn-loading' : ''}`}
                  onClick={handleBuildTree}
                  disabled={isBuilding || sections.every((s) => !s.name)}
                  id="build-tree-btn"
                >
                  {isBuilding ? (
                    <>
                      <span className="spinner" />
                      Building Merkle Tree...
                    </>
                  ) : (
                    <>
                      Build Merkle Tree
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Build & List */}
          {step === 3 && selectedDoc && (
            <div className="publish-card card fade-in" id="step-anchor">
              <h2 className="heading-md">Merkle Root Computed</h2>
              <p className="text-sm">Your host backend built the Merkle tree from <strong>{selectedDoc.title}</strong>. Register as a host and list this document on the marketplace.</p>

              <div className="merkle-root-display">
                <div className="text-xs">Computed Merkle Root</div>
                <code className="merkle-root-hash text-mono">{merkleRoot}</code>
                <div className="merkle-meta">
                  <span className="badge">{totalLeaves} leaves (padded)</span>
                  <span className="badge">~{totalLeaves > 0 ? Math.ceil(Math.log2(totalLeaves)) : 0} levels deep</span>
                  <span className="badge">{sections.filter((s) => s.name).length} sections</span>
                  <span className="badge">ddocId: {selectedDdocId.slice(0, 12)}...</span>
                </div>
              </div>

              {!listingResult ? (
                <button
                  className={`btn btn-primary btn-lg ${isListing ? 'btn-loading' : ''}`}
                  onClick={handleListOnMarketplace}
                  disabled={isListing}
                  id="anchor-btn"
                >
                  {isListing ? (
                    <>
                      <span className="spinner" />
                      Registering host & listing document...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinejoin="round"/>
                      </svg>
                      List on Marketplace
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
                  <h3 className="heading-sm">Document Listed Successfully!</h3>
                  <p className="text-sm">
                    Your document is now live on the marketplace. When a buyer purchases a section,
                    the marketplace forwards the request to your host backend which generates the Merkle proof
                    and creates a disclosure doc on Fileverse.
                  </p>
                  <div className="anchor-details">
                    <div className="sidebar-field">
                      <span className="text-xs">Document ID</span>
                      <code className="sidebar-hash text-mono">{listingResult.docId}</code>
                    </div>
                    <div className="sidebar-field">
                      <span className="text-xs">Merkle Root</span>
                      <code className="sidebar-hash text-mono">{merkleRoot}</code>
                    </div>
                    <div className="sidebar-field">
                      <span className="text-xs">Host ID</span>
                      <code className="sidebar-hash text-mono">{hostId}</code>
                    </div>
                    <div className="sidebar-field">
                      <span className="text-xs">Fileverse ddocId</span>
                      <code className="sidebar-hash text-mono">{selectedDdocId}</code>
                    </div>
                  </div>
                  <a href="/marketplace" className="btn btn-outline" id="view-marketplace">
                    View on Marketplace
                  </a>
                </div>
              )}

              <div className="publish-form-actions">
                <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
