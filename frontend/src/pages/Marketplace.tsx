import { useState, useEffect, useCallback } from 'react';
import DocumentCard from '../components/DocumentCard';
import { listDocuments, type DocumentListing } from '../api/marketplace';
import './Marketplace.css';

const TAGS = ['All', 'DeFi', 'Security', 'Research', 'AI', 'ZK', 'MEV', 'Infrastructure'];

export default function Marketplace() {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDocuments(searchQuery, activeTag);
      setDocuments(data.documents);
    } catch (err: any) {
      setError(err.message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTag]);

  useEffect(() => {
    const timer = setTimeout(fetchDocs, 300);
    return () => clearTimeout(timer);
  }, [fetchDocs]);

  const totalHosts = new Set(documents.map(d => d.hostId)).size;

  return (
    <div className="marketplace-page">
      <div className="container">
        {/* Header */}
        <div className="marketplace-header fade-in" id="marketplace-header">
          <h1 className="heading-lg">Marketplace</h1>
          <p className="text-body">Browse verified documents and purchase access to individual sections. All content is cryptographically proven.</p>
        </div>

        {/* Stats Bar */}
        <div className="marketplace-stats fade-in stagger-1" id="marketplace-stats">
          <div className="stat-item">
            <span className="stat-value">{documents.length}</span>
            <span className="stat-label">Documents</span>
          </div>
          <span className="stat-sep">·</span>
          <div className="stat-item">
            <span className="stat-value">{documents.reduce((s, d) => s + d.sections.length, 0)}</span>
            <span className="stat-label">Sections</span>
          </div>
          <span className="stat-sep">·</span>
          <div className="stat-item">
            <span className="stat-value">{totalHosts}</span>
            <span className="stat-label">Hosts</span>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="marketplace-controls fade-in stagger-2" id="marketplace-controls">
          <div className="search-wrap">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="input input-lg search-input"
              placeholder="Search documents, authors, topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="marketplace-search"
            />
          </div>

          <div className="filter-tags" id="marketplace-filters">
            {TAGS.map(tag => (
              <button
                key={tag}
                className={`badge ${activeTag === tag ? 'badge-active' : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="marketplace-results-info">
          <span className="text-sm">
            {loading ? 'Loading...' : `${documents.length} document${documents.length !== 1 ? 's' : ''} found`}
          </span>
        </div>

        {error && (
          <div className="empty-state" id="error-state">
            <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load: {error}</p>
          </div>
        )}

        {/* Document Grid */}
        {!loading && documents.length > 0 ? (
          <div className="document-grid" id="document-grid">
            {documents.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} index={i} />
            ))}
          </div>
        ) : !loading && !error ? (
          <div className="empty-state" id="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>No documents found</h3>
            <p className="text-sm">No hosts have listed documents yet, or try adjusting your search.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
