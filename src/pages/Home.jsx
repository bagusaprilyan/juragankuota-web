import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api, rupiah } from '../lib/api.js'
import { deteksiOperator, normalisasi, normalisasiTarget } from '../lib/operator.js'

// Kategori layanan utama ala WABA
const TABS = [
  { id: 'PULSA', label: 'Pulsa', icon: '📱', desc: 'Isi pulsa reguler semua operator' },
  { id: 'PAKET DATA', label: 'Paket Data', icon: '🌐', desc: 'Kuota harian, bulanan & unlimited' },
  { id: 'TOKEN PLN', label: 'Token PLN', icon: '⚡', desc: 'Listrik prabayar 24 jam' },
  { id: 'DOMPET DIGITAL', label: 'E-Wallet', icon: '💳', desc: 'DANA, GoPay, OVO, ShopeePay' },
  { id: 'E-MONEY', label: 'E-Money', icon: '🚌', desc: 'Flazz BCA, Tapcash BNI, e-Toll Mandiri' },
  { id: 'GAME', label: 'TopUp Game', icon: '🎮', desc: 'Diamond ML, FF, PUBG & 20+ game' },
  { id: 'VOUCHER', label: 'Voucher Game', icon: '🎟️', desc: 'Steam, UniPin, Garena, Roblox' },
  { id: 'STREAMING', label: 'Streaming', icon: '🎬', desc: 'Vidio, Spotify, WeTV, Genflix' },
]

export default function Home() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  // State navigasi katalog
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'PULSA')
  const [nomor, setNomor] = useState(params.get('nomor') || '')
  const [selectedSub, setSelectedSub] = useState(params.get('sub') || '')
  const [selectedBrand, setSelectedBrand] = useState(params.get('brand') || '')
  const [selectedGame, setSelectedGame] = useState(params.get('game') || '')

  // Data dari backend
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Deteksi operator lokal instan untuk feedback ketik (WABA prefix map)
  const opLocal = useMemo(() => deteksiOperator(nomor), [nomor])

  // Ganti tab utama
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSelectedSub('')
    setSelectedBrand('')
    setSelectedGame('')
    setSearchQuery('')
    setParams({ tab: tabId, ...(nomor ? { nomor } : {}) }, { replace: true })
  }

  // Sinkronkan tab bila URL berubah dari luar (mis. klik link footer)
  const tabDariUrl = params.get('tab')
  useEffect(() => {
    if (tabDariUrl && tabDariUrl !== activeTab) {
      setActiveTab(tabDariUrl)
      setSelectedSub(''); setSelectedBrand(''); setSelectedGame('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabDariUrl])

  // Load katalog dari backend tiap state berubah
  useEffect(() => {
    let cancel = false
    setLoading(true)

    const reqData = {
      tab: activeTab,
      nomor: normalisasiTarget(nomor, activeTab),
      sub: selectedSub,
      brand: selectedBrand,
      game: selectedGame,
    }

    api.katalog(reqData)
      .then((res) => {
        if (cancel) return
        setData(res)
      })
      .catch(() => {
        if (cancel) return
        setData({ error: true, produk: [] })
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })

    return () => { cancel = true }
  }, [activeTab, nomor, selectedSub, selectedBrand, selectedGame])

  // Filter produk berdasarkan input pencarian lokal
  const produkList = useMemo(() => {
    const list = data?.produk || []
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (p) =>
        (p.keterangan || '').toLowerCase().includes(q) ||
        (p.produk || '').toLowerCase().includes(q) ||
        (p.kode || '').toLowerCase().includes(q)
    )
  }, [data?.produk, searchQuery])

  // Menuju halaman pembayaran
  const handlePilihProduk = (kode) => {
    const queryStr = nomor ? `?dest=${encodeURIComponent(normalisasiTarget(nomor, activeTab))}` : ''
    navigate(`/order/${kode}${queryStr}`)
  }

  return (
    <main className="home-comic-container">
      {/* ── HERO BANNER KOMIK SKETSA ── */}
      <section className="hero-comic-panel">
        <div className="hero-comic-badge">⚡ RESMI & 24 JAM NONSTOP</div>
        <h1 className="hero-comic-title">
          Isi Pulsa & Kuota <span className="highlight-sketch">Tanpa Ribet!</span>
        </h1>
        <div className="hero-speech-bubble">
          💬 "Ketik nomor HP kamu dulu, kami carikan paket yang paling pas & murah!"
        </div>

        {/* 3 LANGKAH GAPTEK-FRIENDLY */}
        <div className="steps-comic-strip">
          <div className="step-card">
            <span className="step-num">1</span>
            <b>Ketik Nomor</b>
            <small>Operator deteksi otomatis</small>
          </div>
          <div className="step-arrow">➔</div>
          <div className="step-card">
            <span className="step-num">2</span>
            <b>Pilih Nominal</b>
            <small>Pasti sesuai & rapi</small>
          </div>
          <div className="step-arrow">➔</div>
          <div className="step-card">
            <span className="step-num">3</span>
            <b>Scan QRIS</b>
            <small>Semua bank & e-wallet</small>
          </div>
        </div>
      </section>

      {/* ── CEK PESANAN (ringkas, tidak mengganggu) ── */}
      <section className="comic-section">
        <Link to="/status" className="cek-pesanan-strip">
          <span className="cek-pesanan-emoji">🧾</span>
          <span className="cek-pesanan-text">
            <b>Sudah pesan & mau lihat hasilnya?</b>
            <small>Cek status / ambil kode & token — pakai nomor tujuan atau Order ID</small>
          </span>
          <span className="cek-pesanan-cta">Buka ➔</span>
        </Link>
      </section>

      {/* ── TAB PILIHAN LAYANAN (KARTUN PILLS) ── */}
      <section className="comic-section">
        <div className="section-label-box">
          <span className="section-icon">📦</span>
          <span className="section-text">PILIH LAYANAN</span>
        </div>

        <div className="services-comic-grid">
          {TABS.map((t) => {
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                className={`service-comic-card ${isActive ? 'active' : ''}`}
                onClick={() => handleTabChange(t.id)}
              >
                <span className="service-comic-icon">{t.icon}</span>
                <span className="service-comic-label">{t.label}</span>
                {isActive && <span className="comic-sparkle">★</span>}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── KONTEN DINAMIS BERDASARKAN ATURAN WABA ── */}
      <section className="comic-section main-content-box">
        {/* ============================================================== */}
        {/* KASUS A: PULSA & PAKET DATA (WAJIB KETIK NOMOR DULU)          */}
        {/* ============================================================== */}
        {(activeTab === 'PULSA' || activeTab === 'PAKET DATA') && (
          <div className="flow-container">
            {/* LANGKAH 1: INPUT NOMOR HP */}
            <div className="comic-input-box">
              <label className="comic-field-label">
                <span className="step-bubble-sm">1</span> Masukkan Nomor HP Kamu:
              </label>
              <div className="input-with-badge-row">
                <input
                  type="tel"
                  inputMode="numeric"
                  className="comic-input-big"
                  placeholder="Contoh: 081234567890"
                  value={nomor}
                  onChange={(e) => {
                    setNomor(e.target.value)
                    setSelectedSub('')
                  }}
                  autoFocus
                />
                {(opLocal || data?.operator) && (
                  <div className="op-detected-pill">
                    <span className="op-icon">{(data?.operator?.icon) || opLocal.icon}</span>
                    <span className="op-name">{(data?.operator?.label) || opLocal.label}</span>
                  </div>
                )}
              </div>

              {!nomor && (
                <div className="comic-hint-box">
                  👈 <b>Ketik nomor HP di atas dulu ya Kak.</b> Produk pulsa & kuota akan otomatis disesuaikan dengan kartu kamu, dijamin tidak tertukar!
                </div>
              )}
            </div>

            {/* JIKA NOMOR SUDAH DIKETIK TAPI OPERATOR BELUM COCOK */}
            {nomor.length >= 4 && !opLocal && !data?.operator && (
              <div className="comic-alert-box warning">
                ⚠️ Awalan nomor <b>{nomor.slice(0, 4)}</b> belum dikenali sebagai operator seluler Indonesia. Periksa kembali nomor kamu.
              </div>
            )}

            {/* UNTUK PAKET DATA: SUB-KATEGORI HARIAN / BULANAN / UNLIMITED */}
            {activeTab === 'PAKET DATA' && data?.sub && data.sub.length > 0 && (
              <div className="subcat-comic-wrapper">
                <label className="comic-field-label">
                  <span className="step-bubble-sm">2</span> Pilih Jenis Paket {data.operator?.label}:
                </label>
                <div className="subcat-comic-pills">
                  {data.sub.map((s) => {
                    const isSubActive = selectedSub === s.label
                    return (
                      <button
                        key={s.label}
                        type="button"
                        className={`subcat-pill ${isSubActive ? 'active' : ''}`}
                        onClick={() => setSelectedSub(s.label)}
                      >
                        <b>{s.label}</b>
                        <span className="subcat-count">{s.jumlah} varian</span>
                      </button>
                    )
                  })}
                </div>

                {!selectedSub && (
                  <div className="comic-hint-box">
                    👆 <b>Pilih salah satu jenis paket di atas</b> (misal: Harian, Bulanan, atau Unlimited).
                  </div>
                )}
              </div>
            )}

            {/* UNTUK PULSA: LANGKAH 2 ADALAH PILIH NOMINAL */}
            {activeTab === 'PULSA' && (opLocal || data?.operator) && (
              <div className="subcat-comic-wrapper">
                <label className="comic-field-label">
                  <span className="step-bubble-sm">2</span> Pilih Nominal Pulsa {(data?.operator?.label) || opLocal.label}:
                </label>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* KASUS B: DOMPET DIGITAL (PILIH BRAND DULU)                    */}
        {/* ============================================================== */}
        {activeTab === 'DOMPET DIGITAL' && (
          <div className="flow-container">
            <label className="comic-field-label">
              <span className="step-bubble-sm">1</span> Pilih Dompet Digital:
            </label>
            <div className="brand-comic-grid">
              {['DANA', 'GoPay', 'OVO', 'ShopeePay', 'LinkAja', 'Grab'].map((b) => {
                const isBrandActive = selectedBrand === b
                return (
                  <button
                    key={b}
                    type="button"
                    className={`brand-comic-btn ${isBrandActive ? 'active' : ''}`}
                    onClick={() => setSelectedBrand(b)}
                  >
                    <span className="brand-btn-name">{b}</span>
                    {isBrandActive && <span className="comic-sparkle">✓</span>}
                  </button>
                )
              })}
            </div>

            {!selectedBrand && (
              <div className="comic-hint-box" style={{ marginTop: 12 }}>
                👆 <b>Klik salah satu e-wallet di atas</b> untuk melihat pilihan nominal saldo.
              </div>
            )}

            {selectedBrand && (
              <div style={{ marginTop: 16 }}>
                <label className="comic-field-label">
                  <span className="step-bubble-sm">2</span> Masukkan Nomor HP {selectedBrand}:
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="comic-input-big"
                  placeholder={`Nomor HP akun ${selectedBrand}`}
                  value={nomor}
                  onChange={(e) => setNomor(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* KASUS C: TOP UP GAME & VOUCHER (PILIH GAME DULU)              */}
        {/* ============================================================== */}
        {(activeTab === 'GAME' || activeTab === 'VOUCHER') && (
          <div className="flow-container">
            <label className="comic-field-label">
              <span className="step-bubble-sm">1</span>{' '}
              {activeTab === 'GAME' ? 'Pilih Game Favorit Kamu:' : 'Pilih Voucher:'}
            </label>

            {data?.games && (
              <div className="game-comic-grid">
                {data.games.map((g) => {
                  const isGameActive = selectedGame === g.key
                  return (
                    <button
                      key={g.key}
                      type="button"
                      className={`game-comic-card ${isGameActive ? 'active' : ''}`}
                      onClick={() => setSelectedGame(g.key)}
                    >
                      <span className="game-card-icon">{g.icon || '🎮'}</span>
                      <span className="game-card-name">{g.label}</span>
                      <span className="game-card-badge">{g.jumlah} item</span>
                    </button>
                  )
                })}
              </div>
            )}

            {!selectedGame && (
              <div className="comic-hint-box" style={{ marginTop: 12 }}>
                👆 <b>Pilih game di atas terlebih dahulu</b> untuk memuat daftar nominal diamond / item.
              </div>
            )}

            {selectedGame && (
              <div style={{ marginTop: 16 }}>
                <label className="comic-field-label">
                  <span className="step-bubble-sm">2</span> Masukkan User ID / Akun:
                </label>
                <input
                  type="text"
                  className="comic-input-big"
                  placeholder="Contoh User ID: 12345678 (Zone ID: 2024)"
                  value={nomor}
                  onChange={(e) => setNomor(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* KASUS D: STREAMING (PILIH LAYANAN DULU)                        */}
        {/* ============================================================== */}
        {activeTab === 'STREAMING' && (
          <div className="flow-container">
            <label className="comic-field-label">
              <span className="step-bubble-sm">1</span> Pilih Layanan Streaming:
            </label>
            <div className="brand-comic-grid">
              {['Vidio', 'Spotify Premium', 'WeTV', 'Genflix'].map((s) => {
                const isActive = selectedBrand === s
                return (
                  <button
                    key={s}
                    type="button"
                    className={`brand-comic-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedBrand(s)}
                  >
                    <span className="brand-btn-name">{s}</span>
                    {isActive && <span className="comic-sparkle">✓</span>}
                  </button>
                )
              })}
            </div>

            {!selectedBrand && (
              <div className="comic-hint-box" style={{ marginTop: 12 }}>
                👆 <b>Pilih layanan streaming di atas</b> untuk melihat paket langganan.
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* KASUS E: TOKEN PLN                                             */}
        {/* ============================================================== */}
        {activeTab === 'TOKEN PLN' && (
          <div className="flow-container">
            <label className="comic-field-label">
              <span className="step-bubble-sm">1</span> Masukkan No Meter / ID Pelanggan PLN:
            </label>
            <input
              type="tel"
              inputMode="numeric"
              className="comic-input-big"
              placeholder="Contoh: 14123456789 (11-12 digit)"
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
            />
            <div className="comic-hint-box" style={{ marginTop: 8 }}>
              ⚡ <b>Token PLN Prabayar 24 Jam.</b> Kode stroom 20-digit akan langsung dikirim setelah bayar.
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* KASUS F: E-MONEY (Flazz, Tapcash, BRIzzi, e-Toll Mandiri)      */}
        {/* ============================================================== */}
        {activeTab === 'E-MONEY' && (
          <div className="flow-container">
            <label className="comic-field-label">
              <span className="step-bubble-sm">1</span> Masukkan Nomor Kartu E-Money (16 digit):
            </label>
            <input
              type="tel"
              inputMode="numeric"
              className="comic-input-big"
              placeholder="Contoh: 1234567890123456 (nomor di belakang kartu)"
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
            />
            <div className="comic-hint-box" style={{ marginTop: 8 }}>
              🚌 <b>Isi Saldo E-Money / e-Toll.</b> Flazz BCA, Tapcash BNI, BRIzzi & e-Toll Mandiri —
              klik e-money di bawah untuk lihat nominalnya.
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* DAFTAR PRODUK (KARTU KOMIK SKETSA)                             */}
        {/* ============================================================== */}
        {loading && (
          <div className="comic-loading-box">
            <div className="comic-spinner" />
            <p>Sedang memuat produk...</p>
          </div>
        )}

        {!loading && produkList.length > 0 && (
          <div className="products-section">
            <div className="products-header-row">
              <div className="products-header-title">
                <span className="comic-star">★</span> PILIH NOMINAL (
                {produkList.length} Tersedia)
              </div>
              {/* FILTER / PENCARIAN CEPAT */}
              <input
                type="text"
                className="comic-search-input"
                placeholder="🔍 Cari nominal / kata kunci…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="products-comic-grid">
              {produkList.map((p) => {
                const harga = p.harga_jual || p.harga
                return (
                  <div
                    key={p.kode}
                    className="product-comic-card"
                    onClick={() => handlePilihProduk(p.kode)}
                  >
                    <div className="product-comic-badge">{p.produk || p.kategori}</div>
                    <div className="product-comic-title">{p.keterangan || p.produk}</div>
                    <div className="product-comic-bottom">
                      <div className="product-comic-price">{rupiah(harga)}</div>
                      <button type="button" className="product-comic-btn">
                        Pilih ➔
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* JIKA TIDAK ADA PRODUK SETELAH SEMUA FILTER DIPENUHI */}
        {!loading &&
          produkList.length === 0 &&
          (nomor || selectedBrand || selectedGame || ['TOKEN PLN', 'E-MONEY'].includes(activeTab)) && (
            <div className="empty-comic-state">
              <p style={{ fontSize: 32 }}>📦</p>
              <h3>Belum ada produk yang cocok</h3>
              <p>Coba pilih kategori lain atau periksa kembali nomor/ID kamu.</p>
            </div>
          )}
      </section>
    </main>
  )
}
