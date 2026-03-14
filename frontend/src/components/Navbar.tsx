import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const [walletConnected, setWalletConnected] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/publish', label: 'Publish' },
    { to: '/verify', label: 'Verify' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar" id="main-navigation">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-logo" id="nav-logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <rect x="8" y="3" width="14" height="18" rx="2" stroke="var(--accent-violet)" strokeWidth="1.5" fill="rgba(139,92,246,0.1)"/>
              <path d="M12 9h6M12 13h4" stroke="var(--accent-violet)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="logo-text">DocShare</span>
        </Link>

        <div className={`navbar-links ${mobileMenuOpen ? 'open' : ''}`}>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
              {isActive(link.to) && <span className="nav-link-indicator" />}
            </Link>
          ))}
        </div>

        <div className="navbar-actions">
          <button
            className={`wallet-btn ${walletConnected ? 'connected' : ''}`}
            onClick={() => setWalletConnected(!walletConnected)}
            id="connect-wallet-btn"
          >
            <span className="wallet-dot" />
            {walletConnected ? '0x1a2b...3c4d' : 'Connect Wallet'}
          </button>

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            id="mobile-menu-toggle"
          >
            <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
              <span /><span /><span />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
