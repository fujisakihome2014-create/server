importScripts('/uv/uv.bundle.js');
importScripts('/uv.config.js');
// ★重要★ headers is not iterable の対策。UVより前にこれを読み込む必要があります
importScripts('/baremux/bare.cjs'); 
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', event => {
    event.respondWith(
        uv.fetch(event)
    );
});
