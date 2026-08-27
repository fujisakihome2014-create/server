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

app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// public フォルダをそのまま配信
app.use(express.static(path.join(__dirname, 'public')));

server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, res);
  } else {
    app(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.route(req, socket, head);
  } else {
    socket.destroy();
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
