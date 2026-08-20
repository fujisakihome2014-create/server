import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import path from 'path';
import { fileURLToPath } from 'url';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 従来型バックアップ用のBareサーバー
const bareServer = createBareServer('/bare/');

// Service Worker の強力な許可ヘッダ
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// 静的ファイルの提供（エポキシのローカル配信は不要になったため削除）
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));
app.use(express.static(path.join(__dirname, 'public')));

// 通常のHTTPリクエストをBareサーバーにルーティング
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  }
});

// WebSocket（リアルタイム通信）のルーティングを最新WispとBareで完璧に分岐
server.on('upgrade', (req, socket, head) => {
  if (req.url.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else if (bareServer.shouldRoute(req)) {
    bareServer.upgrade(req, socket, head);
  } else {
    socket.end();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});
