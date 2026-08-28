import express from 'express';
import { createServer } from 'node:http';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import path from 'path';
import { fileURLToPath } from 'url';

import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 自前のpublicを最優先で配信(index.html, uv.config.js など)
app.use(express.static(path.join(__dirname, 'public')));

// ベンダー(公式UV/epoxy/bare-mux)の配信ファイル
app.use('/uv/', express.static(uvPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use('/baremux/', express.static(baremuxPath));

// それ以外は404
app.use((req, res) => {
    res.status(404).send('Not Found');
});

const server = createServer();

server.on('request', (req, res) => {
    // COOP/COEP: SharedArrayBuffer等を使うepoxy-transportに必要
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
