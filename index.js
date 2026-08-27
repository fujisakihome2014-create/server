import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 外部通信を仲介する Bare サーバー
const bareServer = createBareServer('/bare/');

// Service Worker や安全な通信に必要なセキュリティヘッダーを付与
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// public フォルダ内のファイルを静的配信
app.use(express.static(path.join(__dirname, 'public')));

// HTTP リクエストのルーティング
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  } else {
    app(req, res);
  }
});

// WebSocket のルーティング
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, socket, head);
  } else {
    socket.destroy();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Secure Proxy Server running on port ${port}`);
});
