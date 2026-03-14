import { useState, useMemo } from 'react';
import DocumentCard from '../components/DocumentCard';
import { MOCK_DOCUMENTS, TAGS, STATS } from '../data/mockData';
import './Marketplace.css';

export default function Marketplace() {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return MOCK_DOCUMENTS.filter(doc => {
      const matchesTag = activeTag === 'All' || doc.tags.includes(activeTag);
      const matchesSearch = searchQuery === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [activeTag, searchQuery]);

  return (
    <div className="marketplace-page">
      <div className="container">
        {/* Header */}
        <div className="marketplace-header fade-in" id="marketplace-header">
          <h1 className="heading-lg">Marketplace</h1>
          <p className="text-body">Browse verified documents and purchase access to individual sections.</p>
        </div>

        {/* Stats Bar */}
        <div className="marketplace-stats fade-in stagger-1" id="marketplace-stats">
          <div className="stat-item">
            <span className="stat-value">{STATS.totalDocuments}</span>
            <span className="stat-label">Documents</span>
          </div>
          <span className="stat-sep">·</span>
          <div className="stat-item">
            <span className="stat-value">{STATS.totalSectionsSold.toLocaleString()}+</span>
            <span className="stat-label">Sections Sold</span>
          </div>
          <span className="stat-sep">·</span>
          <div className="stat-item">
            <span className="stat-value">{STATS.totalRevenue}</span>
            <span className="stat-label">Revenue</span>
          </div>
          <span className="stat-sep">·</span>
          <div className="stat-item">
            <span className="stat-value">{STATS.activeAuthors}</span>
            <span className="stat-label">Authors</span>
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
          <span className="text-sm">{filtered.length} document{filtered.length !== 1 ? 's' : ''} found</span>
        </div>

        {/* Document Grid */}
        {filtered.length > 0 ? (
          <div className="document-grid" id="document-grid">
            {filtered.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty-state" id="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>No documents found</h3>
            <p className="text-sm">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
