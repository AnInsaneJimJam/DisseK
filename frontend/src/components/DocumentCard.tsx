import { Link } from 'react-router-dom';
import type { DocumentListing } from '../api/marketplace';
import './DocumentCard.css';

interface Props {
  doc: DocumentListing;
  index?: number;
}

export default function DocumentCard({ doc, index = 0 }: Props) {
  const prices = doc.sections.map(s => s.pricePerLine * (s.lineEnd - s.lineStart + 1));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const hostName = doc.host?.name || 'Unknown Host';

  return (
    <Link
      to={`/document/${doc.id}`}
      className={`doc-card card card-interactive card-glow fade-in stagger-${Math.min(index + 1, 5)}`}
      id={`doc-card-${doc.id}`}
    >
      <div className="doc-card-header">
        <div className="doc-card-author-row">
          <div className="doc-card-avatar" style={{ background: `linear-gradient(135deg, hsl(${(doc.title.length * 37) % 360}, 60%, 50%), hsl(${(doc.title.length * 37 + 40) % 360}, 70%, 40%))` }}>
            {hostName.charAt(0)}
          </div>
          <div className="doc-card-author-info">
            <span className="doc-card-author">{hostName}</span>
            <span className="doc-card-address text-mono">
              {doc.host?.trustModel === 'institution' ? doc.host.institution : `Rep: ${doc.host?.reputation ?? 0}`}
            </span>
          </div>
          {doc.merkleRoot && (
            <div className="doc-card-verified" title="Merkle root anchored on-chain">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      <h3 className="doc-card-title">{doc.title}</h3>
      <p className="doc-card-desc">{doc.description}</p>

      <div className="doc-card-tags">
        {doc.tags.map(tag => (
          <span key={tag} className="badge">{tag}</span>
        ))}
        <span className={`badge ${doc.host?.trustModel === 'institution' ? 'badge-success' : ''}`}>
          {doc.host?.trustModel === 'institution' ? 'Signed' : 'Reputation'}
        </span>
      </div>

      <div className="doc-card-footer">
        <div className="doc-card-meta">
          <span className="doc-card-sections">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round"/>
            </svg>
            {doc.sections.length} sections
          </span>
          <span className="doc-card-purchases">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round"/>
            </svg>
            {doc.totalLines} lines
          </span>
        </div>
        <div className="doc-card-price">
          {minPrice === 0 && maxPrice === 0 ? (
            <span className="price price-free">Free</span>
          ) : (
            <span className="price">
              {minPrice.toFixed(2) === maxPrice.toFixed(2)
                ? `$${maxPrice.toFixed(2)}`
                : `$${minPrice.toFixed(2)} — $${maxPrice.toFixed(2)}`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
