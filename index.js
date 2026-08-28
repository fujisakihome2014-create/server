import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Bareサーバーを /bare/ で作成
const bareServer = createBareServer('/bare/');

// ヘッダーのカスタム設定を完全に排除し、純粋に静的ファイルを配信
app.use(express.static(path.join(__dirname, 'public')));

// HTTPリクエストのルーティング
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
    socket.destroy();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
