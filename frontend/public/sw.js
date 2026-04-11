// Nexus Trade Service Worker
// キャッシュ戦略: アプリシェルはキャッシュファースト、APIはネットワークファースト
const CACHE   = 'nexus-trade-v1';
const OFFLINE = '/offline.html';

// インストール時: アプリシェルをプリキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/screener', '/settings']))
      .then(() => self.skipWaiting())
  );
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// フェッチ時の戦略
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // WebSocket / API は SW をバイパス
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

  // POST/DELETE/PATCH などの変更系リクエストはバイパス
  if (e.request.method !== 'GET') return;

  // 静的アセット (_next/static) → キャッシュファースト
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }))
    );
    return;
  }

  // ページ遷移 → ネットワークファースト、失敗時はキャッシュ
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      })
      .catch(() => caches.match(e.request).then(c => c ?? new Response('Offline', { status: 503 })))
  );
});
