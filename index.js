import express from 'express';
import { createServer } from 'node:http';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import path from 'path';
import { fileURLToPath } from 'url';

import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 自前のpublicを最優先で配信(index.html, sw.js など)
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// 学習用の簡易サーバーサイドモード
// サーバー自身がURLを取得し、HTML内のリンクを /fetch/... 経由に書き換えて返す。
// Scramjetのようなブラウザ側でのJS書き換えは行わないので、
// 単純なHTMLサイト向けの、動作原理を体験するための実装。
// ---------------------------------------------------------------------------
app.get('/fetch/*', async (req, res) => {
    let target;
    try {
        target = decodeURIComponent(req.originalUrl.slice('/fetch/'.length));
    } catch (e) {
        target = req.originalUrl.slice('/fetch/'.length);
    }

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        return res.status(400).send('Invalid target URL');
    }

    try {
        const upstream = await fetch(target, {
            headers: { 'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0' },
            redirect: 'follow',
        });

        const contentType = upstream.headers.get('content-type') || '';
        const finalUrl = upstream.url || target;

        if (contentType.includes('text/html')) {
            let html = await upstream.text();

            const rewriteAttr = (source, attr) => {
                const re = new RegExp(attr + '\\s*=\\s*(["\'])(.*?)\\1', 'gi');
                return source.replace(re, (match, quote, url) => {
                    if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('#')) {
                        return match;
                    }
                    try {
                        const abs = new URL(url, finalUrl).href;
                        return attr + '=' + quote + '/fetch/' + encodeURIComponent(abs) + quote;
                    } catch (e) {
                        return match;
                    }
                });
            };

            html = rewriteAttr(html, 'href');
            html = rewriteAttr(html, 'src');
            html = rewriteAttr(html, 'action');

            res.set('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } else {
            res.set('Content-Type', contentType || 'application/octet-stream');
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.send(buf);
        }
    } catch (err) {
        res.status(502).send('サーバーモードでの取得に失敗しました: ' + err.message);
    }
});

// ベンダー(公式Scramjet/libcurl/bare-mux)の配信ファイル
app.use('/scram/', express.static(scramjetPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));

// それ以外は404
app.use((req, res) => {
    res.status(404).send('Not Found');
});

const server = createServer();

server.on('request', (req, res) => {
    // COOP/COEP: SharedArrayBufferを使うゲームサイト等のために必要
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    app(req, res);
});

// WebSocketのアップグレードはWispプロトコルへ
server.on('upgrade', (req, socket, head) => {
    if (req.url.endsWith('/wisp/')) {
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log(`Server running on port ${port}`));
