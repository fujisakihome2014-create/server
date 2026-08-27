import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Bare サーバーの作成
const bareServer = createBareServer('/bare/');

// ヘッダーの二重送信を防ぐ安全なミドルウェア
app.use((req, res, next) => {
  if (!res.headersSent) {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  next();
});

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// HTTP リクエストのルーティング（正しいメソッドに修正）
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.handleRequest(req, res); // <-- .route から .handleRequest に変更
  } else {
    app(req, res);
  }
});

// WebSocket のルーティング（正しいメソッドに修正）
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.handleUpgrade(req, socket, head); // <-- .route から .handleUpgrade に変更
  } else {
    socket.destroy();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Secure Proxy Server running on port ${port}`);
});
