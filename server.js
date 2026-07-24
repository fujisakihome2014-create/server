const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// GAS側と完全に同期させた複合化・復元関数
function secureTunnelDecrypt(encryptedToken) {
    try {
        const secretKey = 0x5A;
        // 2回分のBase64を解除
        let decoded = Buffer.from(Buffer.from(encryptedToken, 'base64').toString('utf8'), 'base64').toString('utf8');
        let original = '';
        for (let i = 0; i < decoded.length; i++) {
            original += String.fromCharCode(decoded.charCodeAt(i) ^ secretKey);
        }
        return original;
    } catch (e) {
        return null;
    }
}

app.use('/proxy/:secureToken', (req, res, next) => {
    const targetUrl = secureTunnelDecrypt(req.params.secureToken);

    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        return res.status(400).send('トンネル認証エラーまたは無効な暗号化トークンです');
    }

    const targetParsed = new URL(targetUrl);

    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'identity',
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
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-content-type-options'];
            delete proxyRes.headers['strict-transport-security'];
            delete proxyRes.headers['permissions-policy'];

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', '*');

            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    return cookie.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=[^\;]+/gi, '; SameSite=None; Secure');
                });
            }

            if (proxyRes.headers['location']) {
                try {
                    let redirectUrl = new URL(proxyRes.headers['location'], targetUrl).toString();
                    // リダイレクト先も同様に暗号化トンネル内にラップする
                    let secretKey = 0x5A;
                    let xored = '';
                    for (let i = 0; i < redirectUrl.length; i++) {
                        xored += String.fromCharCode(redirectUrl.charCodeAt(i) ^ secretKey);
                    }
                    let reEncrypted = Buffer.from(Buffer.from(xored).toString('base64')).toString('base64');
                    proxyRes.headers['location'] = '/proxy/' + reEncrypted;
                } catch (e) {}
            }
        },
        onError: (err, req, res) => {
            res.status(500).send('プロキシトンネル通信エラー: ' + err.message);
        }
    })(req, res, next);
});

app.listen(PORT, () => {
    console.log(`最強プロキシトンネルサーバー起動: http://localhost:${PORT}`);
});
