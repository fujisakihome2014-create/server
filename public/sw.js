importScripts('/uv/uv.bundle.js');
importScripts('/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
    // MessagePortを必要とする処理でエラーが出ないよう、uv.fetchを安全にラップ
    try {
        event.respondWith(
            uv.fetch(event).catch((err) => {
                console.error("UV Fetch Error:", err);
                return fetch(event.request);
            })
        );
    } catch (e) {
        event.respondWith(fetch(event.request));
    }
});
