/* Service Worker JuraganKuota — offline shell + auto-update.
   PENTING: asset di-hash (index-XXXX.js) jadi aman cache-first.
   index.html & navigasi SELALU network-first agar rilis baru langsung kepakai
   (jangan sampai user nyangkut di bundle lama). */
const CACHE = 'jk-pwa-v2'   // naikkan versi tiap rilis penting
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return

  // HTML / navigasi: NETWORK-FIRST — selalu ambil terbaru, cache hanya offline.
  const isHTML = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  if (isHTML) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    )
    return
  }

  // Aset ber-hash (index-XXXX.js/css): cache-first (immutable, aman).
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok && res.status === 200) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      }).catch(() => cached)
    )
  )
})
