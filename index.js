import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Bareサーバーのインスタンス作成
const bareServer = createBareServer('/bare/');

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// リクエストのルーティング（競合を防ぐための安全な条件分岐）
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    try {
      bareServer.routeRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Bare Server Error');
      }
    }
  } else {
    app(req, res);
  }
});

// WebSocketのアップグレード処理
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    try {
      bareServer.routeUpgrade(req, socket, head);
    } catch (err) {
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
