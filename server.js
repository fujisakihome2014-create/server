const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/proxy/:encodedUrl', (req, res, next) => {
    let targetUrl;
    try {
        targetUrl = Buffer.from(req.params.encodedUrl, 'base64').toString('utf8');
    } catch (e) {
        return res.status(400).send('無効なURLエンコードです');
    }

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        return res.status(400).send('有効なURLが指定されていません');
    }

    // ターゲットのホスト名やオリジンを取得
    const targetParsed = new URL(targetUrl);

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        // 最強レベルのブラウザ偽装ヘッダー
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Referer': targetParsed.origin + '/'
        },
        router: (req) => targetUrl,
        pathRewrite: {
            '^/proxy/[^/]+': '',
        },
        onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('X-Forwarded-For', req.ip);
            proxyReq.setHeader('Origin', targetParsed.origin);
        },
        onProxyRes: (proxyRes, req, res) => {
            // 1. セキュリティ制限・埋め込みブロックヘッダーをすべて消去
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-content-type-options'];
            delete proxyRes.headers['strict-transport-security'];
            delete proxyRes.headers['permissions-policy'];
            delete proxyRes.headers['cross-origin-opener-policy'];
            delete proxyRes.headers['cross-origin-embedder-policy'];

            // 2. CORSの完全解放
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', '*');

            // 3. クッキーのセキュア制限を緩和してiframe内でのセッション維持を可能にする
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    return cookie.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=[^\;]+/gi, '; SameSite=None; Secure');
                });
            }

            // 4. リダイレクト（Locationヘッダー）が発生した際もプロキシ経由を維持するように書き換え
            if (proxyRes.headers['location']) {
                try {
                    let redirectUrl = new URL(proxyRes.headers['location'], targetUrl).toString();
                    proxyRes.headers['location'] = '/proxy/' + Buffer.from(redirectUrl).toString('base64');
                } catch (e) {}
            }
        },
        onError: (err, req, res) => {
            res.status(500).send('プロキシ通信エラー（ブロックまたは接続失敗）: ' + err.message);
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`プロキシサーバー起動: http://localhost:${PORT}`);
});
