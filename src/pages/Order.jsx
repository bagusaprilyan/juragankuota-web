import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api, rupiah } from '../lib/api.js'
import { deteksiOperator, normalisasi, normalisasiTarget, nomorValid } from '../lib/operator.js'

const KATEGORI_SELULER = [
  'PULSA', 'KUOTA TELKOMSEL', 'KUOTA INDOSAT', 'KUOTA XL', 'KUOTA AXIS',
  'KUOTA TRI', 'KUOTA SMARTFREN', 'KUOTA BYU', 'PAKET DATA',
]

export default function Order() {
  const { kode } = useParams()
  const [sp, setSp] = useSearchParams()

  const [p, setP] = useState(null)
  const [dest, setDest] = useState(sp.get('dest') || '')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const [order, setOrder] = useState(null)
  const [liveStatus, setLiveStatus] = useState('pending')
  const [sukses, setSukses] = useState(false)
  const [gagal, setGagal] = useState(false)
  const [ditahan, setDitahan] = useState(false)
  const [sn, setSn] = useState('')
  const [alt, setAlt] = useState(null)
  const [cekManual, setCekManual] = useState(false)
  const [pesanCek, setPesanCek] = useState('')

  // Restore order: (1) dari ?order=<id> di URL, (2) dari localStorage sesi terakhir.
  // Tujuan: token/SN tetap terlihat setelah reload / buka ulang.
  useEffect(() => {
    const oidUrl = sp.get('order')
    if (oidUrl) {
      // Muat order dari server & sinkronkan token lewat jalur normal (polling).
      api.orderDetail(oidUrl).then((d) => {
        if (d?.order_id) setOrder(d)
      }).catch(() => { /* diamkan */ })
      return
    }
    try {
      const saved = JSON.parse(localStorage.getItem('jk_last_order') || 'null')
      if (saved?.order_id && saved?.kode === kode && saved?.dest === (sp.get('dest') || '')) {
        setOrder(saved.order)
      }
    } catch { /* diamkan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cek nama penerima (e-wallet / token PLN / tagihan)
  const [cekMemuat, setCekMemuat] = useState(false)
  const [cekHasil, setCekHasil] = useState(null)   // {valid, nama, keterangan}
  const [cekErr, setCekErr] = useState('')
  const [namaTerverifikasi, setNamaTerverifikasi] = useState('')

  const [copiedKey, setCopiedKey] = useState('')   // key tombol yg baru disalin

  const salin = async (teks, key = 'sn') => {
    if (!teks) return
    const teksBersih = String(teks).trim()
    let berhasil = false
    try {
      await navigator.clipboard.writeText(teksBersih)
      berhasil = true
    } catch {
      // fallback utk browser lama / non-HTTPS: textarea + execCommand
      try {
        const ta = document.createElement('textarea')
        ta.value = teksBersih; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        berhasil = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { berhasil = false }
    }
    // Tandai state apa pun hasilnya — kalau gagal pun tetap beri tahu user
    setCopiedKey(berhasil ? key : key + ':gagal')
    setTimeout(() => setCopiedKey(''), berhasil ? 1800 : 3000)
  }

  // Ambil token PLN (20 digit) dari SN apa pun bentuknya:
  // - "12345678901234567890"        → 1234-5678-9012-3456-7890
  // - "3076-2990-8653-3382-7898"    → tetap (sudah berformat)
  // - "3076-2990-8653-3382-7898/MINI/R1M/900VA/13.6 KWH" → ambil 20 digit awal
  const formatToken = (t) => {
    const s = String(t || '').trim()
    // Kumpulkan 20 digit pertama dari string (abaikan '-' atau teks tambahan)
    const digitAja = s.replace(/\D/g, '')
    if (digitAja.length >= 20) {
      return digitAja.slice(0, 20).replace(/(\d{4})(?=\d)/g, '$1-').replace(/-$/, '')
    }
    // Kalau SN sudah berformat 4-4-4-4-4, biarkan apa adanya
    if (/^\d{4}(-\d{4}){4}$/.test(s)) return s
    return s
  }

  // Ambil token mentah (tanpa strip) untuk fungsi salin — agar paste ke meteran bersih
  const tokenMentah = (t) => String(t || '').replace(/\D/g, '').slice(0, 20) || String(t || '').trim()

  useEffect(() => {
    let hidup = true
    setLoading(true); setErr('')
    api.product(kode)
      .then((data) => {
        if (!hidup) return
        setP(data)
        document.title = `Beli ${data.nama || data.produk || data.kode} — JuraganKuota`
      })
      .catch(() => { if (hidup) setErr('Produk tidak ditemukan atau sedang gangguan.') })
      .finally(() => { if (hidup) setLoading(false) })
    return () => { hidup = false }
  }, [kode])

  const op = useMemo(() => deteksiOperator(dest), [dest])
  const kat = (p?.kategori || '').toUpperCase()
  const nama = (p?.nama || p?.produk || '').toUpperCase()
  const isSeluler = KATEGORI_SELULER.includes(kat)

  // Validasi kecocokan operator vs produk (khusus kategori seluler)
  const cocok = useMemo(() => {
    if (!op || !isSeluler) return true
    if (kat !== 'PULSA') return true // kuota sudah dipecah per kategori brand
    const label = (op.label || '').toUpperCase()
    const alias = (op.pulsa || '').toUpperCase()
    const opLain = ['TELKOMSEL', 'INDOSAT', 'XL', 'AXIS', 'THREE', 'TRI', 'SMARTFREN', 'BY U', 'BYU']
    const adaOpLain = opLain.some((o) => o !== label && o !== alias && nama.includes(o))
    return !adaOpLain
  }, [op, isSeluler, kat, nama])

  // Cari produk alternatif bila operator tidak cocok
  useEffect(() => {
    if (!op || cocok || !isSeluler) { setAlt(null); return }
    let batal = false
    const cari = async () => {
      try {
        const r = await api.katalog({ tab: 'PULSA', nomor: normalisasi(dest) })
        if (batal) return
        const list = r.produk || []
        if (!list.length) { setAlt(null); return }
        const target = p?.harga_jual || p?.harga || 0
        const sorted = [...list].sort(
          (a, b) => Math.abs((a.harga_jual || a.harga) - target) - Math.abs((b.harga_jual || b.harga) - target)
        )
        setAlt(sorted[0])
      } catch { /* diamkan */ }
    }
    cari()
    return () => { batal = true }
  }, [op, cocok, isSeluler, dest, p])

  // Apakah produk ini mendukung cek nama penerima?
  const bisaCekNama = useMemo(() => {
    const k = (kat || '').toUpperCase()
    const nm = (nama || '').toUpperCase()
    if (/DOMPET|DIGITAL|EWALLET/.test(k) && /DANA|OVO|SHOPEE|LINKAJA|GRAB/.test(nm)) return true
    if (/PLN|TOKEN|TAGIHAN|PDAM|BPJS|TELKOM/.test(k)) return true
    return false
  }, [kat, nama])

  // Reset hasil cek nama bila nomor diubah
  useEffect(() => { setCekHasil(null); setCekErr(''); setNamaTerverifikasi('') }, [dest])

  const cekNama = async () => {
    if (!dest || !p) return
    setCekMemuat(true); setCekErr(''); setCekHasil(null)
    try {
      const r = await api.cekNama(normalisasiTarget(dest, kat, kat), p.kode)
      setCekHasil(r)
      if (r.valid && r.nama) setNamaTerverifikasi(r.nama)
    } catch (e) {
      setCekErr('Gagal cek nama. Coba lagi sebentar.')
    } finally {
      setCekMemuat(false)
    }
  }

  const handleBayar = async (e) => {
    e.preventDefault()
    if (!dest || !p) return
    setSubmitting(true); setErr('')
    try {
      const res = await api.order({
        kode: p.kode,
        tujuan: normalisasiTarget(dest, kat, kat),
        ...(namaTerverifikasi ? { nama_penerima: namaTerverifikasi } : {}),
      })
      if (!res.order_id && !res.trx_id && !res.id) throw new Error(res.error || 'Gagal membuat tagihan QRIS.')
      setOrder(res)
      const oid = res.order_id || res.trx_id || res.id
      // Tandai URL dengan ?order=<id> supaya refresh / buka ulang tetap menampilkan token
      try { setSp((prev) => { const n = new URLSearchParams(prev); n.set('order', oid); return n }) } catch { /* diamkan */ }
      try {
        localStorage.setItem('jk_last_order', JSON.stringify({
          order_id: oid, kode, dest, order: res
        }))
      } catch { /* diamkan */ }
    } catch (e2) {
      setErr(e2.message || 'Terjadi kesalahan sistem.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Cek status sekali (dipakai polling & tombol "Sudah Bayar") ──
  const cekStatusSekali = useCallback(async () => {
    const id = order?.order_id || order?.trx_id || order?.id
    if (!id) return false
    try {
      const c = await api.checkout(id)
      if (c.status) setLiveStatus(c.status)
      if (c.sukses) setSukses(true)
      if (c.gagal) setGagal(true)
      // Order ditahan karena saldo server kurang → pesan khusus (jaminan refund)
      if (c.ditahan) setDitahan(true)
      // Ambil SN/token: utamakan dari checkout, fallback ke endpoint order_detail
      // (webhook kadang mengisi oke_sn beberapa detik SETELAH status jadi success)
      let snBaru = c.sn || c.oke_sn
      if (!snBaru && (c.sukses || ['success', 'executed'].includes(String(c.oke_status || '').toLowerCase()))) {
        try {
          const d = await api.orderDetail(id)
          snBaru = d?.oke_sn || d?.sn || ''
        } catch { /* diamkan */ }
      }
      if (snBaru) setSn(snBaru)
      const final = c.sukses || c.gagal || c.ditahan ||
        ['success', 'done', 'failed', 'expired', 'executed', 'paid', 'insufficient'].includes(String(c.status))
      // Jangan berhenti polling kalau SUDAH sukses tapi SN/token belum ada
      // (khusus produk yang menghasilkan SN/token — PLN, voucher, dll).
      const butuhSn = (c.sukses || ['success', 'executed'].includes(String(c.oke_status || '').toLowerCase()))
      if (butuhSn && !snBaru) return false
      return !!final
    } catch { return false }
  }, [order])

  // Polling status realtime — auto-refresh sampai sukses/gagal
  useEffect(() => {
    const id = order?.order_id || order?.trx_id || order?.id
    if (!id) return
    let berhenti = false
    cekStatusSekali()
    const timer = setInterval(async () => {
      const done = await cekStatusSekali()
      if (done || berhenti) clearInterval(timer)
    }, 4000)
    return () => clearInterval(timer)
  }, [order, cekStatusSekali])

  // ── Tombol "Sudah Bayar": cek instan + pantau cepat 20 detik ──
  const handleSudahBayar = async () => {
    if (cekManual) return
    setCekManual(true); setPesanCek('')
    let selesai = false
    // pantau intensif: cek tiap 2 detik sampai 20 detik (10x)
    for (let i = 0; i < 10 && !selesai; i++) {
      selesai = await cekStatusSekali()
      if (selesai) break
      if (i === 0) setPesanCek('⏳ Pembayaran belum terdeteksi… kami cek otomatis sebentar lagi.')
      await new Promise(r => setTimeout(r, 2000))
    }
    if (!selesai) {
      setPesanCek('⏳ Belum terdeteksi. Kalau sudah bayar, tunggu 1–2 menit lagi — kadang bank butuh waktu. Status berubah otomatis.')
    }
    setCekManual(false)
  }

  // Validasi ID tujuan sesuai jenis produk (cegah salah input / ID tidak valid).
  const idValid = useMemo(() => {
    const d = String(dest || '').trim()
    if (!d) return { ok: false, msg: '' }
    const k = (kat || '').toUpperCase()
    // Nomor HP: wajib format 08xx (10-13 digit).
    if (isSeluler || k === 'PULSA' || k.includes('KUOTA') || k.includes('DOMPET')) {
      return nomorValid(d)
        ? { ok: true, msg: '' }
        : { ok: false, msg: 'Nomor HP harus diawali 08 dan 10–13 digit.' }
    }
    // Token PLN / tagihan PLN: angka 11-12 digit, TIDAK diawali 0.
    if (k.includes('PLN')) {
      if (!/^[1-9][0-9]{10,11}$/.test(d))
        return { ok: false, msg: 'ID Meter / No Pelanggan PLN harus 11–12 digit angka & tidak diawali 0 (contoh: 86221093592).' }
      return { ok: true, msg: '' }
    }
    // E-Money: nomor kartu, umumnya 16 digit.
    if (k.includes('E-MONEY') || k.includes('EMONEY') || k.includes('MONETER') || k.includes('UANG ELEKTRONIK')) {
      if (!/^[0-9]{10,19}$/.test(d))
        return { ok: false, msg: 'Nomor kartu e-money harus berupa angka (umumnya 16 digit).' }
      return { ok: true, msg: '' }
    }
    // Game: User ID angka (opsional Zone ID dengan pemisah #|() ).
    if (k.includes('GAME') || k.includes('DIGITAL') || k.includes('VOUCHER')) {
      if (!/^[0-9A-Za-z#|()\- ]{4,32}$/.test(d))
        return { ok: false, msg: 'User ID game tidak valid. Masukkan ID angka (mis. 123456789).' }
      return { ok: true, msg: '' }
    }
    // PDAM / PBB / tagihan: angka/alfanumerik.
    if (k.includes('PDAM') || k.includes('PBB') || k.includes('TAGIHAN')) {
      if (!/^[0-9A-Za-z]{6,32}$/.test(d))
        return { ok: false, msg: 'Nomor pelanggan tidak valid.' }
      return { ok: true, msg: '' }
    }
    return { ok: d.length >= 4, msg: d.length >= 4 ? '' : 'ID tujuan minimal 4 karakter.' }
  }, [dest, kat, isSeluler])

  const bayarDisabled = submitting || !dest || !idValid.ok || (isSeluler && op && !cocok)

  // Placeholder & hint smart per kategori — supaya user awam tahu harus isi apa
  const { placeholderTujuan, hintTujuan } = useMemo(() => {
    if (isSeluler) {
      return { placeholderTujuan: 'Contoh: 081234567890',
               hintTujuan: 'Operator otomatis terdeteksi dari awalan nomor — pastikan nomor benar.' }
    }
    if (kat.includes('PLN')) {
      return { placeholderTujuan: 'Contoh: 526530229677',
               hintTujuan: 'Masukkan 11–12 digit ID Meter / Nomor Pelanggan PLN.' }
    }
    if (kat.includes('DOMPET')) {
      return { placeholderTujuan: 'Contoh: 081234567890',
               hintTujuan: 'Masukkan nomor HP yang terdaftar di akun dompet digital (DANA/OVO/GoPay).' }
    }
    if (kat.includes('DIGITAL') || kat.includes('GAME') || nama.includes('TPG')) {
      return { placeholderTujuan: 'Contoh: 123456789 (User ID game)',
               hintTujuan: 'Masukkan User ID akun game — bukan nama atau email. Cek di profil game kamu.' }
    }
    if (kat.includes('TAGIHAN')) {
      return { placeholderTujuan: 'Contoh: nomor pelanggan',
               hintTujuan: 'Masukkan nomor pelanggan sesuai tagihan.' }
    }
    return { placeholderTujuan: 'Masukkan ID / nomor tujuan',
             hintTujuan: 'Periksa kembali ID tujuan sebelum membayar.' }
  }, [isSeluler, kat, nama])

  if (loading) {
    return (
      <main className="page-main">
        <div className="order-comic-panel">
          <div className="skel-comic" style={{ height: 90, marginBottom: 14 }} />
          <div className="skel-comic" style={{ height: 56, marginBottom: 10 }} />
          <div className="skel-comic" style={{ height: 56 }} />
        </div>
      </main>
    )
  }

  if (err && !p) {
    return (
      <main className="page-main">
        <div className="order-comic-panel text-center">
          <p style={{ fontSize: 34, marginBottom: 8 }}>😵</p>
          <h2 style={{ marginBottom: 10 }}>Produk Tidak Ditemukan</h2>
          <p style={{ color: 'var(--ink-muted)', fontWeight: 700, marginBottom: 16 }}>{err}</p>
          <Link className="btn-help" to="/">← Kembali ke Katalog</Link>
        </div>
      </main>
    )
  }

  const harga = p.harga_jual || p.harga

  return (
    <main className="page-main">
      <div className="order-comic-panel">
        <Link className="order-back-link" to="/">← Ganti Produk</Link>

        {/* RINGKASAN PRODUK */}
        <div className="order-summary-box">
          <div>
            <div className="order-product-name">{p.nama || p.produk || p.kode}</div>
            <span className="order-product-cat">{p.kategori}</span>
          </div>
          <div className="order-product-price">{rupiah(harga)}</div>
        </div>

        {!order && (
          <form onSubmit={handleBayar}>
            {/* NOMOR / ID TUJUAN */}
            <div className="form-step-block">
              <div className="step-label-row">
                <span className="step-bubble-num">1</span>
                <span>{isSeluler ? 'Nomor HP Tujuan:' : 'ID / Akun Tujuan:'}</span>
              </div>
              <input
                className="comic-input"
                inputMode={isSeluler ? 'numeric' : 'text'}
                placeholder={placeholderTujuan}
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                autoFocus
                required
              />
              <div className="input-hint-text">{hintTujuan}</div>
              {dest && !idValid.ok && idValid.msg && (
                <div className="input-hint-text" style={{ color: '#dc2626', fontWeight: 800 }}>
                  ⚠️ {idValid.msg}
                </div>
              )}

              {/* CEK NAMA PENERIMA — e-wallet / token PLN / tagihan */}
              {bisaCekNama && dest.length >= 4 && !order && (
                <div className="ceknama-box">
                  {!cekHasil && !cekMemuat && (
                    <button type="button" className="btn-ceknama" onClick={cekNama}>
                      🔍 Cek Nama Penerima
                    </button>
                  )}
                  {cekMemuat && (
                    <div className="ceknama-loading">
                      <span className="ceknama-spinner" /> Sedang mengecek nama penerima…
                    </div>
                  )}
                  {cekHasil?.valid && cekHasil?.nama && (
                    <div className="ceknama-ok">
                      <div className="ceknama-ok-label">✅ Nama Penerima Terverifikasi:</div>
                      <div className="ceknama-ok-nama">{cekHasil.nama}</div>
                      {cekHasil.keterangan && (
                        <div className="ceknama-ok-ket">{cekHasil.keterangan}</div>
                      )}
                      <div className="ceknama-ok-tip">
                        Pastikan nama ini <b>benar</b> sebelum membayar. Uang tidak bisa ditarik kembali.
                      </div>
                    </div>
                  )}
                  {cekHasil && !cekHasil.valid && (
                    <div className="ceknama-gagal">
                      ⚠️ {cekHasil.keterangan || 'Nama tidak ditemukan untuk nomor ini.'}
                      <button type="button" className="btn-ceknama-kecil" onClick={cekNama}>
                        Coba Lagi
                      </button>
                    </div>
                  )}
                  {cekErr && <div className="ceknama-gagal">⚠️ {cekErr}</div>}
                </div>
              )}

              <div className="comic-hint-box" style={{ fontSize: 12.5 }}>
                🔔 Hasil (kode/SN/token) muncul otomatis di halaman ini begitu pembayaran masuk —
                bisa juga dibuka lagi kapan saja lewat menu <b>“Cek Pesanan”</b>.
              </div>

              {/* BADGE OPERATOR */}
              {isSeluler && op && (
                <div className="detected-op-box">
                  <span className="detected-op-badge">
                    <span>{op.icon}</span> {op.label}
                  </span>
                  {cocok ? (
                    <span className="detected-op-status">Operator Cocok ✅</span>
                  ) : (
                    <span className="detected-op-status" style={{ color: 'var(--coral)' }}>Operator Tidak Sesuai ⚠️</span>
                  )}
                </div>
              )}

              {/* PERINGATAN MISMATCH */}
              {isSeluler && op && !cocok && (
                <div className="mismatch-alert-comic">
                  <div className="mismatch-msg">
                    ⚠️ Nomor kamu terdeteksi <b>{op.label}</b>, tapi produk yang kamu pilih milik operator lain.
                    Yuk ganti ke produk <b>{op.label}</b> agar pulsanya tidak gagal:
                  </div>
                  {alt ? (
                    <Link className="alt-product-card" to={`/order/${alt.kode}?dest=${encodeURIComponent(normalisasiTarget(dest, kat, kat))}`}>
                      <div className="alt-info">
                        <b>{alt.keterangan || alt.nama || alt.produk}</b>
                        <span>{rupiah(alt.harga_jual || alt.harga)}</span>
                      </div>
                      <span className="btn-switch-alt">Ganti ke {op.label} ➔</span>
                    </Link>
                  ) : (
                    <div className="alt-info">Produk {op.label} sedang tidak tersedia. Coba kembali nanti.</div>
                  )}
                </div>
              )}
            </div>

            {err && <div className="mismatch-alert-comic"><div className="mismatch-msg">{err}</div></div>}

            <button className="btn-pay-comic" type="submit" disabled={bayarDisabled}>
              {submitting ? '⏳ Menyiapkan QRIS…'
                : isSeluler && op && !cocok ? '❌ Nomor Tidak Sesuai Operator'
                : bisaCekNama && namaTerverifikasi ? `⚡ Bayar untuk ${namaTerverifikasi} — ${rupiah(harga)}`
                : `⚡ Bayar Sekarang — ${rupiah(harga)}`}
            </button>
            {bisaCekNama && !namaTerverifikasi && (
              <div className="bayar-nama-warning">
                💡 Sebaiknya klik <b>“Cek Nama Penerima”</b> dulu di atas supaya yakin nomor &amp; nama penerima benar.
              </div>
            )}
          </form>
        )}

        {/* PEMBAYARAN */}
        {order && (
          <div className="qris-panel-comic">
            <span className="qris-badge-top">QRIS RESMI</span>

            {/* ── KALAU SUDAH SUKSES: tampilkan hasil besar ── */}
            {sukses ? (
              <div className="hasil-sukses-box">
                <div className="hasil-sukses-emoji">🎉</div>
                <h2 className="hasil-sukses-judul">TRANSAKSI BERHASIL!</h2>
                <p className="hasil-sukses-sub">Pesanan sudah diproses &amp; selesai.</p>
                {(() => {
                  const isPln = /pln/i.test(p.kategori || '') || /^PLN/i.test(p.kode || '')
                  if (!sn && !isPln) return null
                  return (
                    <div className={`sn-copy-box${isPln ? ' sn-pln' : ''}`} style={{ marginTop: 14 }}>
                      <div className="sn-copy-label">
                        {isPln ? '⚡ Token PLN — masukkan ke meteran:' : '🔑 Kode / SN / Hasil:'}
                      </div>
                      {sn ? (
                        <>
                          <div className={`sn-copy-value${isPln ? ' sn-token-pln' : ''}`}>
                            {isPln ? formatToken(sn) : sn}
                          </div>
                          <button
                            type="button"
                            className={`btn-copy-sn${copiedKey === 'sn' ? ' ok' : ''}`}
                            onClick={() => salin(isPln ? tokenMentah(sn) : sn, 'sn')}
                          >
                            {copiedKey === 'sn' ? '✅ Tersalin!' : copiedKey === 'sn:gagal' ? '⚠️ Gagal — salin manual' : '📋 Salin Token'}
                          </button>
                          {isPln && (
                            <p className="sn-hint">⚠️ Masukkan 20 digit token ini ke meteran PLN.</p>
                          )}
                        </>
                      ) : (
                        <div className="sn-copy-value" style={{ fontSize: 14, fontWeight: 700 }}>
                          ⏳ Token sedang disiapkan… halaman ini menyegar otomatis. Kalau tidak muncul,
                          buka <b>Halaman Status</b> di bawah ya Kak.
                        </div>
                      )}
                    </div>
                  )
                })()}
                <div className="hasil-sukses-detail">
                  <div><span>Order ID</span><b>{order.order_id || order.id}</b></div>
                  <div><span>Produk</span><b>{order.produk || p.nama || p.produk}</b></div>
                  <div><span>Tujuan</span><b>{order.tujuan || dest}</b></div>
                  {order.nama_penerima && <div><span>Nama Penerima</span><b>{order.nama_penerima}</b></div>}
                  <div><span>Total</span><b>{rupiah(order.amount || order.total || harga)}</b></div>
                </div>
                <Link className="btn-help" to={`/status/${order.order_id || order.id}`} style={{ marginTop: 14 }}>
                  🧾 Lihat di Halaman Status
                </Link>
              </div>
            ) : ditahan ? (
              /* ── ORDER DITAHAN: user sudah bayar, tapi saldo server kurang ──
                 Komitmen: user TIDAK dirugikan — diproses manual / direfund. */
              <div className="hasil-sukses-box" style={{ background: 'var(--yellow)' }}>
                <div className="hasil-sukses-emoji">✋</div>
                <h2 className="hasil-sukses-judul" style={{ fontSize: 20 }}>PEMBAYARAN DITERIMA</h2>
                <p className="hasil-sukses-sub" style={{ fontWeight: 700 }}>
                  Pesananmu sedang <b>diproses manual</b> oleh tim kami.
                </p>
                <div className="comic-hint-box" style={{ textAlign: 'left', marginTop: 12 }}>
                  Pembayaranmu <b>aman & tercatat</b> ✅. Karena antrean operator sedang penuh,
                  pesanan diselesaikan manual oleh admin.<br /><br />
                  ⏱️ Maksimal <b>15 menit</b> (jam kerja). Kalau lewat, kami <b>proses atau refund penuh</b> ya —
                  kamu tidak akan rugi.
                </div>
                <div className="hasil-sukses-detail" style={{ marginTop: 12 }}>
                  <div><span>Order ID</span><b>{order.order_id || order.id}</b></div>
                  <div><span>Tujuan</span><b>{order.tujuan || dest}</b></div>
                  <div><span>Total</span><b>{rupiah(order.amount || order.total || harga)}</b></div>
                </div>
                <a className="btn-help" href="https://wa.me/6285647376259" target="_blank" rel="noreferrer" style={{ marginTop: 14 }}>
                  💬 Chat Admin (sertakan Order ID)
                </a>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 19, marginBottom: 4 }}>Selesaikan Pembayaran</h2>
                <p style={{ color: 'var(--ink-muted)', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  Total: <b>{rupiah(order.amount || order.total || harga)}</b>
                </p>

                {/* ORDER ID — bisa disalin untuk cek ulang kapan saja */}
                {(order.order_id || order.id) && (
                  <div className="sn-copy-box" style={{ padding: '10px 12px', marginTop: 4 }}>
                    <div className="sn-copy-label" style={{ fontSize: 11.5 }}>🧾 Order ID (simpan untuk cek pesanan):</div>
                    <div className="sn-copy-value" style={{ fontSize: 17 }}>{order.order_id || order.id}</div>
                    <button type="button" className={`btn-copy-sn${copiedKey === 'oid' ? ' ok' : ''}`} onClick={() => salin(order.order_id || order.id, 'oid')}>
                      {copiedKey === 'oid' ? '✅ Tersalin!' : '📋 Salin'}
                    </button>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  {gagal ? (
                    <span className="status-badge-live failed">❌ Pembayaran Gagal / Kedaluwarsa</span>
                  ) : ['paid', 'success', 'done'].includes(String(liveStatus)) ? (
                    <span className="status-badge-live success">🎉 Pembayaran Diterima — sedang diproses…</span>
                  ) : (
                    <span className="status-badge-live waiting">👉 Scan QR di bawah, lalu tekan “Sudah Bayar”</span>
                  )}
                </div>

                {/* Tombol "Sudah Bayar" — cek instan tanpa menunggu polling */}
                <button
                  type="button"
                  className="btn-sudah-bayar"
                  onClick={handleSudahBayar}
                  disabled={cekManual}
                >
                  {cekManual ? '⏳ Mengecek pembayaran…' : '✅ Sudah Bayar — Cek Sekarang'}
                </button>
                {pesanCek && <div className="pesan-cek">{pesanCek}</div>}

                {/* QRIS — QR asli dirender langsung (diextract dari gateway) */}
                {(() => {
                  const svg = order.qr_svg || ''
                  const pl  = order.payment_link || order.pay_url || order.payment_url || order.link
                  if (!svg && !pl) return null
                  return (
                    <div className="qris-box-comic">
                      {svg ? (
                        <>
                          <div className="qris-live-head">
                            <span className="qris-live-dot" /> Scan QRIS ini
                          </div>
                          <div className="qris-svg-holder" dangerouslySetInnerHTML={{ __html: svg }} />
                          <div className="qris-live-note">
                            Scan pakai m-banking / e-wallet apa saja (GoPay, DANA, OVO, ShopeePay…)
                          </div>
                        </>
                      ) : (
                        <div className="qris-live-note" style={{ marginTop: 4 }}>
                          QR sedang disiapkan… bila tak muncul, buka halaman pembayaran di bawah.
                        </div>
                      )}
                      {pl && (
                        <div className="qris-iframe-fallback">
                          QR tidak muncul?
                          <a href={pl} target="_blank" rel="noreferrer"> Buka halaman pembayaran ➔</a>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Kalau backend menyediakan gambar QR langsung, tampilkan juga */}
                {(order.qris_url || order.qr_url || order.qris || order.qr_image) && (
                  <div className="qris-img-box mt-16">
                    <img src={order.qris_url || order.qr_url || order.qris || order.qr_image} alt="QRIS Pembayaran" />
                  </div>
                )}

                <div className="qris-guide-box">
                  <b>Cara Pembayaran:</b>
                  <ol style={{ paddingLeft: 18, marginTop: 6 }}>
                    <li>Scan kode <b>QRIS</b> di atas pakai m-banking / e-wallet.</li>
                    <li>Periksa nominal <b>{rupiah(order.amount || order.total || harga)}</b> lalu bayar.</li>
                    <li>Setelah bayar, tekan tombol <b>“✅ Sudah Bayar — Cek Sekarang”</b> untuk cek langsung.</li>
                    <li>Kalau belum terbaca, tunggu sebentar — halaman <b>berubah otomatis jadi “TRANSAKSI BERHASIL”</b>.</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
                  {(order.order_id || order.id) && (
                    <Link className="btn-help" to={`/status/${order.order_id || order.id}`}>
                      🧾 Buka Halaman Status
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
