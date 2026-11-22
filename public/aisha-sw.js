// Dashboard service worker (Aisha and Aarohi): makes the dashboard installable as an app.
// Live data is never cached; only the app shell (page + static files) is kept for a fast start.
const CACHE = "aisha-shell-v1";
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("aisha-shell-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return; // live data: straight to the network
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/aisha/") || url.pathname.startsWith("/aarohi/");
  if (isStatic) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  if (req.mode === "navigate") {
    // Page: network first (always fresh), saved copy only when offline.
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then(hit => hit || new Response("<h3 style='font-family:sans-serif;padding:24px'>Internet nahi hai — connection aate hi dashboard khul jayega.</h3>", { headers: { "Content-Type": "text/html; charset=utf-8" } }))));
  }
});
