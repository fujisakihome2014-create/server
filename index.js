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

const bareServer = createBareServer('/bare/');

// Service Worker の許可ヘッダを厳格化
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

// 静的ファイルの提供
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(baremuxPath));
app.use(express.static(path.join(__dirname, 'public')));

// ★超重要対策：プロキシ用のパスを含め、存在しないページはすべて index.html へ流す
// これにより、SWが読み込まれる前に404になるのを防ぎます
app.get('/*', (req, res, next) => {
  if (req.url.startsWith('/uv/service/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

// 通常のHTTPリクエストをBareサーバーにルーティング
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  } else {
    // 静的ファイルなどが見つからない場合は index.html を返す
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// WebSocketルーティング
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
