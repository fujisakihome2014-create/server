import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 【超重要】: 引数に app を入れない（二重処理を防ぐ）
const server = http.createServer();

// Bareサーバーを /bare/ で作成
const bareServer = createBareServer('/bare/');

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// 唯一のリクエスト処理（ここで初めて振り分ける）
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// WebSocketのアップグレード処理
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
