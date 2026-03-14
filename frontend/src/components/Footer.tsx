import './Footer.css';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer" id="site-footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <rect x="8" y="3" width="14" height="18" rx="2" stroke="var(--accent-violet)" strokeWidth="1.5" fill="rgba(139,92,246,0.1)"/>
              </svg>
              <span>DocShare</span>
            </Link>
            <p className="footer-tagline">
              Sell knowledge, not documents. Cryptographic proof of authenticity for every section.
            </p>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Product</h4>
              <Link to="/marketplace">Marketplace</Link>
              <Link to="/publish">Publish</Link>
              <Link to="/verify">Verify</Link>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href="https://docs.fileverse.io" target="_blank" rel="noopener noreferrer">Fileverse Docs</a>
              <a href="#" aria-label="Documentation">Documentation</a>
              <a href="#" aria-label="GitHub">GitHub</a>
            </div>
            <div className="footer-col">
              <h4>Built With</h4>
              <span className="footer-tech">Rust + WASM</span>
              <span className="footer-tech">ENSIP-25</span>
              <span className="footer-tech">x402 Protocol</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>Built for EthMumbai 2026 · Powered by Fileverse</p>
          <div className="footer-badges">
            <span className="badge badge-violet">Sepolia Testnet</span>
            <span className="badge">SHA256 Merkle Proofs</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
