importScripts('/uv/uv.bundle.js');
importScripts('/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
    // リクエストがプロキシ経由（/sw/ など）のものであれば Ultraviolet で処理する
    if (event.request.url.includes(__uv$config.prefix)) {
        event.respondWith(uv.fetch(event));
    }
});
