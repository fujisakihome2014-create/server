import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

// ==========================================
// 【最重要】プロセスクラッシュを防ぐガード
// クライアントの通信切断による内部エラーを無視し、サーバーを落とさない
// ==========================================
process.on('uncaughtException', (err) => {
    console.error('Ignored Uncaught Exception:', err.message);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bareServer = createBareServer('/bare/');
const app = express();
const server = http.createServer(); // 引数にappは入れない

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// 該当しないURLには安全に404を返す
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// Bareサーバーへのルーティング
server.on('request', (req, res) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeRequest(req, res);
    } else {
        app(req, res);
    }
});

server.on('upgrade', (req, socket, head) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeUpgrade(req, socket, head);
    } else {
        socket.end();
    }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
