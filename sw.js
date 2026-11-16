/* =========================================================
   PW · Service Worker（PWA 离线 / 安装为 APP）
   策略：network-first，网络成功则缓存副本并返回，失败回退缓存。
   带 ?v= 的脚本/样式始终走网络，确保版本更新后立即生效。
   版本号变化（CACHE 常量）时自动清掉旧缓存。
   ========================================================= */
const CACHE = 'pw-v-20261116c';
const CORE = [
  './', 'index.html', 'css/app.css',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => { if (k !== CACHE) return caches.delete(k); })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // 仅缓存同源 basic 响应（忽略跨域/错误响应）
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('index.html')))
  );
});
