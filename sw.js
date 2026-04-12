'use strict';

var CACHE_NAME = 'lianzi-cache';

/* ── 安裝：只預先快取入口頁，其餘資源等第一次存取時再快取 ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll([
          '/taiping-special-ed/',
          '/taiping-special-ed/index.html'
        ]);
      })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

/* ── 攔截請求：Network First ── */
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* 外部服務（Firebase、CDN、字型）直接走網路，不快取 */
  if (url.includes('firebase') ||
      url.includes('googleapis') ||
      url.includes('gstatic') ||
      url.includes('jsdelivr') ||
      url.includes('cdnjs') ||
      url.includes('fonts.g')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function(response) {
        /* 有網路：存到快取後回傳最新版本 */
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        /* 離線：從快取取出備份 */
        return caches.match(e.request);
      })
  );
});
