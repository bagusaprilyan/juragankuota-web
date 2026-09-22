import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Order from './pages/Order.jsx'
import Status from './pages/Status.jsx'
import './style.css'

const WA_ADMIN = 'https://wa.me/6285647376259'

export default function App() {
  const { pathname } = useLocation()

  return (
    <div className="page-shell">
      {/* NAVBAR KOMIK SKETSA */}
      <nav className="topbar">
        <Link to="/" className="brand-badge">
          <span className="logo-dot" />
          JuraganKuota
        </Link>
        <div className="topbar-links">
          <a className="topbar-link wa-link" href={WA_ADMIN} target="_blank" rel="noreferrer">
            💬 Bantuan
          </a>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/order/:kode" element={<Order />} />
        <Route path="/cek" element={<Status />} />
        <Route path="/status" element={<Status />} />
        <Route path="/status/:orderId" element={<Status />} />
        <Route path="*" element={<Home />} />
      </Routes>

      {/* FOOTER KOMIK */}
      <footer className="site-footer">
        <div className="footer-brand">⚡ JuraganKuota</div>
        <p className="footer-desc">
          Isi pulsa, paket data, token PLN &amp; top-up game online 24 jam via QRIS.
          Proses otomatis, tanpa antre, tanpa konfirmasi manual.
        </p>
        <div className="footer-links">
          <Link className="footer-link" to="/?tab=PULSA">📱 Pulsa</Link>
          <Link className="footer-link" to="/?tab=PAKET DATA">🌐 Paket Data</Link>
          <Link className="footer-link" to="/?tab=TOKEN PLN">⚡ Token PLN</Link>
          <Link className="footer-link" to="/?tab=DOMPET DIGITAL">💳 E-Wallet</Link>
          <Link className="footer-link" to="/?tab=GAME">🎮 TopUp Game</Link>
          <Link className="footer-link" to="/cek">🧾 Cek Pesanan</Link>
          <a className="footer-link" href={WA_ADMIN} target="_blank" rel="noreferrer">
            💬 Chat Admin
          </a>
        </div>
        <p className="footer-copy">
          © {new Date().getFullYear()} JuraganKuota — PPOB Online 24 Jam
        </p>
      </footer>
    </div>
  )
}
