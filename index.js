import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    if (!res.headersSent) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
  }
}));

// シンプルなプロキシのエンドポイント（例: /proxy?url=https://example.com）
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('URLが指定されていません。');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const body = await response.text();
    
    // レスポンスのヘッダーを引き継いで返す
    response.headers.forEach((val, key) => {
      // セキュリティ上の制限があるヘッダーを除外
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });

    res.status(response.status).send(body);
  } catch (err) {
    res.status(500).send('プロキシエラー: ' + err.message);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Simple Proxy Server running on port ${port}`);
});
