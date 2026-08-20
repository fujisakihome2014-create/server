importScripts('/baremux/worker.js');
importScripts('/uv/uv.bundle.js');
importScripts('/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
    // 条件分岐で弾かずに、すべてのリクエストを Ultraviolet に処理させることでサイトの開き残しを無くす
    event.respondWith(
        uv.fetch(event)
    );
});
