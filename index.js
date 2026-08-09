import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const bareServer = createBareServer('/bare/');

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// Ultravioletのプレフィックス（/sw/）へのアクセスを public/index.html または Service Worker に通すルーティング
app.get('/sw/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  } else {
    app(req, res);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
