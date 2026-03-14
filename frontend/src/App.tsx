import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Marketplace from './pages/Marketplace';
import DocumentDetail from './pages/DocumentDetail';
import Publish from './pages/Publish';
import Verify from './pages/Verify';

function App() {
  return (
    <BrowserRouter>
      {/* Background decorations */}
      <div className="bg-gradient-orbs" />
      <div className="bg-grid" />

      <Navbar />

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/document/:id" element={<DocumentDetail />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/verify" element={<Verify />} />
        </Routes>
      </main>

      <Footer />
    </BrowserRouter>
  );
}

export default App;
