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

    const targetParsed = new URL(targetUrl);

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'identity', // 圧縮させないことで文字化けを防止
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': targetParsed.origin + '/'
        },
        router: (req) => targetUrl,
        pathRewrite: {
            '^/proxy/[^/]+': '',
        },
        onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('X-Forwarded-For', req.ip);
            proxyReq.setHeader('Origin', targetParsed.origin);
            proxyReq.removeHeader('Accept-Encoding');
            proxyReq.setHeader('Accept-Encoding', 'identity');
        },
        onProxyRes: (proxyRes, req, res) => {
            // セキュリティ・ブロックヘッダーの削除
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-content-type-options'];
            delete proxyRes.headers['strict-transport-security'];
            delete proxyRes.headers['permissions-policy'];

            // CORSの完全解放
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', '*');

            // Cookieの維持
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    return cookie.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=[^\;]+/gi, '; SameSite=None; Secure');
                });
            }

            // リダイレクト対策
            if (proxyRes.headers['location']) {
                try {
                    let redirectUrl = new URL(proxyRes.headers['location'], targetUrl).toString();
                    proxyRes.headers['location'] = '/proxy/' + Buffer.from(redirectUrl).toString('base64');
                } catch (e) {}
            }

            // HTMLレスポンス内のリンクをプロキシ経由に書き換える処理（テキストデータの場合のみ）
            const contentType = proxyRes.headers['content-type'] || '';
            if (contentType.includes('text/html')) {
                let originalSend = res.end;
                let responseBody = Buffer.from([]);

                proxyRes.on('data', (chunk) => {
                    responseBody = Buffer.concat([responseBody, chunk]);
                });

                proxyRes.on('end', () => {
                    let bodyStr = responseBody.toString('utf8');
                    
                    // ページの相対パスや絶対パスをプロキシ形式に置換するベース処理
                    // 例: href="/path" を href="/proxy/[base64]" に変換
                    bodyStr = bodyStr.replace(/(href|src|action)=["'](\/[^"']+)["']/g, (match, attr, path) => {
                        try {
                            let absoluteUrl = new URL(path, targetUrl).toString();
                            let encoded = Buffer.from(absoluteUrl).toString('base64');
                            return `${attr}="/proxy/${encoded}"`;
                        } catch (e) {
                            return match;
                        }
                    });

                    res.setHeader('Content-Length', Buffer.byteLength(bodyStr));
                    res.end(bodyStr);
                });

                // デフォルトの送信をキャンセルして手動で書き換えたデータを返す
                return;
            }
        },
        onError: (err, req, res) => {
            res.status(500).send('プロキシ通信エラー: ' + err.message);
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`プロキシサーバー起動: http://localhost:${PORT}`);
});
