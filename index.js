import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 自サーバー上でBareサーバーを完全に稼働
const bareServer = createBareServer('/bare/');

app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  next();
});

app.use('/uv/', express.static(uvPath));
app.use(express.static(path.join(__dirname, 'public')));

// HTTPリクエストをBareサーバーへ
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// WebSocket/Upgrade通信をBareサーバーへ
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.upgrade(req, socket, head);
  } else {
    socket.end();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});
