// BareMuxとUltravioletの依存関係をすべてインポート
importScripts('/baremux/worker.js');
importScripts('/uv/uv.bundle.js');
importScripts('/uv.config.js');
importScripts('/uv/uv.sw.js');

const uv = new UVServiceWorker();

// fetchイベント（ネットワークリクエスト）を横取りする
self.addEventListener('fetch', (event) => {
    event.respondWith(
        (async () => {
            // リクエストがプロキシ対象（/uv/service/...など）かどうかを判定
            if (uv.route(event)) {
                // プロキシ経由で画像や動画、HTMLを取得
                return await uv.fetch(event);
            }
            // プロキシ対象外（通常のサイト自体のファイル）はそのまま返す
            return await fetch(event.request);
        })()
    );
});
