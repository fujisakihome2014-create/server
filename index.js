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
