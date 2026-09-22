import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, rupiah } from '../lib/api.js'

/* Halaman Cek Pesanan — bisa cari lewat NOMOR / ID TUJUAN (utama) atau Order ID.
   Hasil tampil real-time + tombol salin kode/SN/token. */

const STATUS_META = {
  pending:  { label: 'Menunggu Pembayaran', icon: '⏳', cls: 'waiting' },
  paid:     { label: 'Sudah Dibayar — Sedang Diproses', icon: '💳', cls: 'waiting' },
  executed: { label: 'Berhasil! Pesanan Selesai', icon: '🎉', cls: 'success' },
  success:  { label: 'Berhasil! Pesanan Selesai', icon: '🎉', cls: 'success' },
  done:     { label: 'Berhasil! Pesanan Selesai', icon: '🎉', cls: 'success' },
  failed:   { label: 'Gagal Diproses', icon: '❌', cls: 'failed' },
  expired:  { label: 'Kedaluwarsa', icon: '⌛', cls: 'failed' },
  ditahan:  { label: 'Diproses Manual oleh Admin', icon: '✋', cls: 'waiting' },
}

function metaDari(d) {
  const st = String(d?.status || '').toLowerCase()
  const okSt = (d?.oke_status || '').toLowerCase()
  const gagalOke = okSt === 'failed'
  // Order ditahan: user sudah bayar, tapi saldo server kurang → diproses manual
  if (okSt === 'insufficient' || d?.ditahan) return STATUS_META.ditahan
  let m = STATUS_META[st] || { label: d?.status || '-', icon: 'ℹ️', cls: 'waiting' }
  if (gagalOke) m = STATUS_META.failed
  return m
}

function KartuPesanan({ d, onSalin, copiedId }) {
  const meta = metaDari(d)
  const sn = d?.oke_sn || ''
  const isPln = /pln/i.test(d?.kategori || '') || /^PLN/i.test(d?.kode || '') || /pln/i.test(d?.produk || '')
  const pending = ['pending', 'paid'].includes(String(d?.status || '').toLowerCase())
  const ditahanIni = (d?.oke_status || '').toLowerCase() === 'insufficient' || d?.ditahan
  const sukses = !pending && meta.cls === 'success'
  // Token PLN: ambil 20 digit pertama (SN bisa berformat 'xxxx-xxxx-.../MINI/R1M/...')
  const tokenPln = String(sn || '').replace(/\D/g, '').slice(0, 20)
  const snTampil = isPln && tokenPln.length >= 20
    ? tokenPln.replace(/(\d{4})(?=\d)/g, '$1-').replace(/-$/, '')
    : sn
  // Yang dikirim ke clipboard: token mentah (tanpa strip) utk PLN
  const snSalin = isPln && tokenPln.length >= 20 ? tokenPln : sn

  return (
    <div className="lacak-card">
      <div className="lacak-card-top">
        <span className={`status-badge-live ${meta.cls}`}>{meta.icon} {meta.label}</span>
        <span className="lacak-tgl">{String(d?.created_at || '').slice(0, 16)}</span>
      </div>

      <div className="lacak-produk">{d?.produk || d?.kode}</div>
      <div className="lacak-detail">
        <span><b>Order ID:</b> {d?.order_id}</span>
        <span><b>Tujuan:</b> {d?.tujuan}</span>
        <span><b>Total:</b> {rupiah(d?.amount)}</span>
      </div>

      {sukses && sn && (
        <div className={`sn-copy-box${isPln ? ' sn-pln' : ''}`} style={{ marginTop: 12 }}>
          <div className="sn-copy-label">{isPln ? '⚡ Token PLN:' : '🔑 Kode / SN:'}</div>
          <div className={`sn-copy-value${isPln ? ' sn-token-pln' : ''}`}>{snTampil}</div>
          <button className={`btn-copy-sn${copiedId === d.order_id ? ' ok' : ''}`} onClick={() => onSalin(snSalin, d.order_id)}>
            {copiedId === d.order_id ? '✅ Tersalin!' : copiedId === d.order_id + ':gagal' ? '⚠️ Salin manual' : '📋 Salin'}
          </button>
          {isPln && <p className="sn-hint">⚠️ Masukkan 20 digit token ini ke meteran PLN.</p>}
        </div>
      )}
      {sukses && !sn && (
        <div className="comic-hint-box" style={{ marginTop: 12, textAlign: 'left' }}>
          ✅ Berhasil diproses — saldo/paket otomatis masuk ke nomor tujuan.
        </div>
      )}
      {meta.cls === 'failed' && (
        <div className="mismatch-alert-comic" style={{ marginTop: 12 }}>
          <div className="mismatch-msg">
            ⚠️ Gagal diproses. Hubungi admin & sertakan Order ID <code>{d.order_id}</code> untuk refund.
          </div>
        </div>
      )}
      {pending && !ditahanIni && (
        <div className="comic-hint-box" style={{ marginTop: 12, textAlign: 'left' }}>
          ⏳ Status menyegar otomatis. {String(d?.status).toLowerCase() === 'pending'
            ? 'Selesaikan pembayaran bila belum.' : 'Pesanan sedang dikirim ke operator.'}
        </div>
      )}
      {ditahanIni && (
        <div className="comic-hint-box" style={{ marginTop: 12, textAlign: 'left' }}>
          ✋ Pembayaranmu <b>aman &amp; tercatat</b>. Pesanan sedang diselesaikan manual oleh admin
          (maks. 15 menit). Kalau lewat, kami <b>proses atau refund penuh</b> — kamu tidak akan rugi.
          Sertakan Order ID <code>{d.order_id}</code> bila menghubungi admin.
        </div>
      )}
    </div>
  )
}

export default function Status() {
  const { orderId: idDariUrl } = useParams()
  const navigate = useNavigate()

  const [mode, setMode] = useState(idDariUrl ? 'id' : 'tujuan') // 'tujuan' | 'id'
  const [input, setInput] = useState(idDariUrl || '')
  const [hasil, setHasil] = useState([])      // array kartu
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sudahCari, setSudahCari] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const timerRef = useRef(null)
  const kunciCari = useRef('')

  const salin = async (teks, id) => {
    const teksBersih = String(teks || '').trim()
    if (!teksBersih) return
    try {
      await navigator.clipboard.writeText(teksBersih)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = teksBersih; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta)
      } catch { return }
    }
    setCopiedId(id); setTimeout(() => setCopiedId(''), 1800)
  }

  const cari = useCallback(async (q, m) => {
    const kode = String(q || '').trim()
    if (!kode) return
    setLoading(true); setErr(''); setSudahCari(true)
    try {
      if (m === 'id') {
        const res = await api.checkout(kode.toUpperCase())
        if (res?.error) throw new Error(res.error)
        setHasil([res])
      } else {
        const res = await api.lacak(kode)
        if (res?.error) throw new Error(res.error)
        setHasil(res.orders || [])
      }
    } catch (e) {
      setHasil([])
      setErr(e.message || 'Tidak ditemukan. Periksa kembali nomor / ID-nya.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Muat dari URL — auto-deteksi nomor tujuan vs Order ID
  useEffect(() => {
    if (!idDariUrl) return
    const s = String(idDariUrl).trim()
    // Order ID selalu diawali "JG" (mis. JG695930-PLNZ20); selain itu anggap nomor/ID tujuan
    const m = /^JG/i.test(s) ? 'id' : 'tujuan'
    setMode(m); setInput(s); kunciCari.current = s
    cari(s, m)
  }, [idDariUrl, cari])

  // Auto-refresh selama masih ada yang pending
  useEffect(() => {
    if (!hasil.length) return
    const masihPending = hasil.some(d => ['pending', 'paid'].includes(String(d.status || '').toLowerCase()))
    if (!masihPending) return
    timerRef.current = setInterval(() => { if (kunciCari.current) cari(kunciCari.current, mode) }, 8000)
    return () => clearInterval(timerRef.current)
  }, [hasil, mode, cari])

  const submit = (e) => {
    e.preventDefault()
    const kode = input.trim()
    if (!kode) return
    kunciCari.current = kode
    if (mode === 'id') navigate(`/status/${kode.toUpperCase()}`, { replace: true })
    else navigate('/status', { replace: true })
    cari(kode, mode)
  }

  const gantiMode = (m) => {
    setMode(m); setInput(''); setHasil([]); setErr(''); setSudahCari(false)
    kunciCari.current = ''
    navigate('/status', { replace: true })
  }

  return (
    <main className="page-main">
      <div className="order-comic-panel">
        <div className="step-label-row" style={{ marginBottom: 6 }}>
          <span className="step-bubble-num">🔎</span>
          <span>Cek Pesanan</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-muted)', fontWeight: 700, marginBottom: 14 }}>
          Cari pesananmu pakai <b>nomor / ID tujuan</b> yang kamu isi saat memesan,
          atau pakai <b>Order ID</b> dari struk.
        </p>

        {/* PILIH CARA CARI */}
        <div className="lacak-mode-tabs">
          <button type="button" className={mode === 'tujuan' ? 'active' : ''} onClick={() => gantiMode('tujuan')}>
            📱 Nomor / ID Tujuan
          </button>
          <button type="button" className={mode === 'id' ? 'active' : ''} onClick={() => gantiMode('id')}>
            🧾 Order ID
          </button>
        </div>

        <form onSubmit={submit} className="input-with-badge-row">
          <input
            className="comic-input-big"
            placeholder={mode === 'id'
              ? 'Contoh: JG695930-PLNZ20'
              : 'Contoh: 081234567890 atau 526530229677'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode={mode === 'tujuan' ? 'numeric' : 'text'}
            autoFocus
          />
          <button type="submit" className="btn-switch-alt" disabled={loading}>
            {loading ? '⏳' : '🔎 Cari'}
          </button>
        </form>

        {err && (
          <div className="mismatch-alert-comic" style={{ marginTop: 14 }}>
            <div className="mismatch-msg">😵 {err}</div>
          </div>
        )}

        {sudahCari && !loading && !err && hasil.length === 0 && (
          <div className="comic-hint-box" style={{ marginTop: 14 }}>
            🤔 Belum ada pesanan dengan nomor/ID itu. Pastikan angkanya sama dengan yang kamu
            isi saat memesan, atau coba cek lewat <b>Order ID</b>.
          </div>
        )}

        {hasil.length > 0 && (
          <div className="lacak-hasil-wrap">
            <div className="lacak-hasil-head">
              ✅ Ditemukan <b>{hasil.length}</b> pesanan — terbaru di atas.
            </div>
            {hasil.map((d) => (
              <KartuPesanan key={d.order_id} d={d} onSalin={salin} copiedId={copiedId} />
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link className="btn-help" to="/">← Pesan Lagi</Link>
        </div>
      </div>
    </main>
  )
}
