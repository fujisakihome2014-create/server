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

// Bareサーバーを明示的なパスで作成
const bareServer = createBareServer('/bare/');

app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Ultravioletの静的ファイルを配信
app.use('/uv/', express.static(uvPath));
app.use(express.static(path.join(__dirname, 'public')));

// HTTPリクエストのルーティング（Bareサーバーを確実に優先処理）
server.on('request', (req, res) => {
  try {
    if (bareServer.shouldRoute(req)) {
      bareServer.route(req, res);
    } else {
      app(req, res);
    }
  } catch (err) {
    console.error('Bare Server Error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

// WebSocket通信のルーティング
server.on('upgrade', (req, socket, head) => {
  try {
    if (bareServer.shouldRoute(req)) {
      bareServer.route(req, socket, head);
    } else {
      socket.destroy();
    }
  } catch (err) {
    console.error('WebSocket Upgrade Error:', err);
    socket.destroy();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});
