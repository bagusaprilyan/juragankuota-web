// Wrapper API — semua request ke backend Flask lewat sini.
const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  health: () => req('/health'),
  categories: () => req('/categories'),
  games: () => req('/games'),
  // Katalog berjenjang persis WABA
  katalog: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return req(`/katalog${qs ? '?' + qs : ''}`)
  },
  products: (params = '') => {
    if (typeof params === 'object') {
      const qs = new URLSearchParams(params).toString()
      return req(`/products${qs ? '?' + qs : ''}`)
    }
    return req(`/products${params}`)
  },
  product: (kode) => req(`/products/${kode}`),
  cekNama: (dest, produk = 'CPLN') => req(`/cek-nama?dest=${encodeURIComponent(dest)}&produk=${produk}`),
  order: (body) => req('/order', { method: 'POST', body: JSON.stringify(body) }),
  checkout: (id) => req(`/checkout/${id}`),
  orderDetail: (id) => req(`/order/${id}`),
  lacak: (tujuan) => req(`/lacak?tujuan=${encodeURIComponent(tujuan)}`),
  cekNama: (dest, produk) =>
    req(`/cek-nama?dest=${encodeURIComponent(dest)}&produk=${encodeURIComponent(produk || '')}`),
  orders: (params = '') => req(`/orders${params}`),
  balance: () => req('/balance'),
}

export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
