/* Deteksi operator seluler Indonesia + normalisasi ID tujuan yang BENAR per kategori.

   SUMBER DATA: PREFIX_MAP di /home/ubuntu/juragame-transaksi/webhook.py (WABA)
   — sengaja diambil dari WABA agar konsisten dgn bot WhatsApp.
   Kunci: longest-match (085156 → ByU, bukan Telkomsel).

   ⚠️ PENTING — BEDA JENIS "TARGET" TIAP PRODUK (jangan disamakan!):
   ┌────────────────┬──────────────────────────────────────────────┬─────────────────────┐
   │ Kategori       │ Yang diinput user (target)                   │ Normalisasi?        │
   ├────────────────┼──────────────────────────────────────────────┼─────────────────────┤
   │ PULSA          │ Nomor HP 08xx / +628xx / 628xx / 8xx         │ YA → 08xx           │
   │ PAKET DATA     │ Nomor HP (sama seperti pulsa)                │ YA → 08xx           │
   │ TOKEN PLN      │ ID Meter / No Pelanggan PLN (11–12 digit)    │ TIDAK (apa adanya)  │
   │ TAGIHAN PLN    │ No Pelanggan PLN                             │ TIDAK               │
   │ E-MONEY        │ Nomor kartu e-money (16 digit)               │ TIDAK               │
   │ DOMPET DIGITAL │ Nomor HP akun dompet (08xx)                  │ YA → 08xx           │
   │ GAME           │ User ID game (angka) atau ID#ZoneID          │ TIDAK               │
   │ VOUCHER        │ Nomor HP penerima / kode voucher             │ YA (bila nomor HP)  │
   │ STREAMING      │ Nomor HP login / email                       │ TIDAK (bisa email)  │
   │ AIR PDAM       │ Nomor pelanggan PDAM                         │ TIDAK               │
   │ TAGIHAN PBB    │ Nomor Objek Pajak (NOP) 18 digit             │ TIDAK               │
   └────────────────┴──────────────────────────────────────────────┴─────────────────────┘

   BUG YANG PERNAH TERJADI: normalisasi() lama SELALU menempel '0' pada input
   berawalan '8' — sehingga ID PLN 86221093592 rusak jadi 086221093592 (listrik
   salah pelanggan!). Sekarang normalisasi hanya dipakai untuk kategori nomor HP.
*/

/* Prefix → operator. Diurutkan otomatis longest-match saat evaluasi.

   ByU = '0851' (4 digit) — KEPUTUSAN BISNIS: semua blok 0851 dianggap ByU.
   Catatan: secara teknis Telkomsel Kartu AS juga memakai 0851, tapi demi
   kesederhanaan user (ketik 0851 → langsung ByU), 0851 kita map ke ByU.
   Karena '0851' sudah dipakai ByU, hapus dari daftar Telkomsel. */
const PREFIX_MAP = {
  byu:      ['0851'],
  telkomsel:['0811','0812','0813','0821','0822','0823','0852','0853','0826'],
  indosat:  ['0814','0815','0816','0855','0856','0857','0858'],
  xl:       ['0817','0818','0819','0859','0877','0878'],
  axis:     ['0831','0832','0833','0837','0838'],
  smartfren:['0881','0882','0883','0884','0885','0886','0887','0888','0889'],
  tri:      ['0895','0896','0897','0898','0899','0890'],
}

/* Daftar prefix terpanjang lebih dulu → cegah 085156 kebaca Telkomsel. */
const PREFIX_URUT = Object.entries(PREFIX_MAP)
  .flatMap(([op, list]) => list.map(pr => ({ op, pr })))
  .sort((a, b) => b.pr.length - a.pr.length)

/* Kategori produk per operator (nama di products.db / WABA). */
const KATEGORI = {
  telkomsel:'KUOTA TELKOMSEL', indosat:'KUOTA INDOSAT', xl:'KUOTA XL',
  axis:'KUOTA AXIS', tri:'KUOTA TRI', smartfren:'KUOTA SMARTFREN', byu:'KUOTA BYU',
}

/* Nama produk PULSA di DB (dari PULSA_PRODUK_MAP WABA). */
const NAMA_PULSA = {
  byu:'By U', tri:'Three', telkomsel:'Telkomsel', indosat:'Indosat',
  xl:'XL', axis:'Axis', smartfren:'Smartfren',
}

/* Metadata tampilan. */
export const OPERATOR_INFO = {
  telkomsel:{ label:'Telkomsel', icon:'🔴', warna:'#e11d48' },
  indosat:  { label:'Indosat',   icon:'🟡', warna:'#f59e0b' },
  xl:       { label:'XL',        icon:'🔵', warna:'#0ea5e9' },
  axis:     { label:'Axis',      icon:'🟣', warna:'#8b5cf6' },
  tri:      { label:'Tri',       icon:'🟣', warna:'#a855f7' },
  smartfren:{ label:'Smartfren', icon:'🟢', warna:'#22c55e' },
  byu:      { label:'By.U',      icon:'⚪', warna:'#64748b' },
}

export const LABEL_PULSA = nama => NAMA_PULSA[nama] || null

/* Kategori yang target-nya NOMOR HP → boleh dinormalisasi ke 08xx.
   Kategori lain (PLN, game, e-money, PDAM, PBB, streaming) JANGAN disentuh. */
const KATEGORI_NOMOR_HP = new Set([
  'PULSA', 'PAKET DATA', 'DOMPET DIGITAL',
])
/* Tab frontend (huruf besar) → kategori terkait. */
const TAB_NOMOR_HP = new Set(['PULSA', 'PAKET DATA', 'DOMPET DIGITAL', 'E-WALLET'])

/* Normalisasi NOMOR HP: 08xx / +628xx / 628xx / 8xx → 08xx.
   HANYA untuk nomor HP. Jangan pakai untuk ID PLN/game/e-money! */
export function normalisasi(nomor) {
  let n = String(nomor || '').replace(/[^0-9+]/g, '')
  if (n.startsWith('+62')) n = '0' + n.slice(3)
  else if (n.startsWith('62')) n = '0' + n.slice(2)
  else if (n.startsWith('8')) n = '0' + n
  return n
}

/* Normalisasi SADAR KATEGORI — pakai ini di alur order/katalog.
   `tab` = activeTab (mis. 'PULSA', 'TOKEN PLN', 'GAME').
   `kategori` opsional = kategori produk (mis. 'TOKEN PLN'). */
export function normalisasiTarget(input, tab = '', kategori = '') {
  const raw = String(input || '').trim()
  const kat = (kategori || '').toUpperCase()
  const t = (tab || '').toUpperCase()
  // Hanya normalisasi bila jelas ini nomor HP.
  const targetNomorHp = KATEGORI_NOMOR_HP.has(kat) || TAB_NOMOR_HP.has(t)
  if (!targetNomorHp) {
    // ID/kode lain: cukup buang spasi & karakter aneh, JANGAN tambah '0'.
    return raw.replace(/\s+/g, '')
  }
  return normalisasi(raw)
}

/* Deteksi operator dari nomor HP. Return {key,label,icon,warna,kategori,pulsa} atau null. */
export function deteksiOperator(nomor) {
  const n = normalisasi(nomor)
  if (n.length < 4) return null
  for (const { op, pr } of PREFIX_URUT) {
    if (n.startsWith(pr)) {
      return { key: op, kategori: KATEGORI[op], pulsa: NAMA_PULSA[op], ...OPERATOR_INFO[op] }
    }
  }
  return null
}

/* Alias kompatibilitas: dulu ada versi "sadar-ambigu", sekarang ByU = '0851'
   jadi sudah tidak ambigu lagi. Selalu kembalikan status 'ok' bila cocok. */
export function deteksiOperatorAman(nomor) {
  const op = deteksiOperator(nomor)
  return op ? { status: 'ok', ...op } : { status: 'none' }
}

/* Validasi panjang nomor seluler Indonesia (10-13 digit mulai 08). */
export function nomorValid(nomor) {
  const n = normalisasi(nomor)
  return /^08[0-9]{8,11}$/.test(n)
}
