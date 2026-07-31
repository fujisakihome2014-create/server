const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* GASからのリクエストを受け付ける /proxy エンドポイント */
app.all('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('URLパラメータが指定されていません。');
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return res.status(400).send('無効なURL形式です。');
  }

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      data: req.body,
      responseType: 'arraybuffer',
      validateStatus: () => true,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'] || 'text/html';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf8');
      const $ = cheerio.load(html);
      return res.send($.html());
    }

    return res.send(response.data);

  } catch (error) {
    console.error("Proxy error:", error.message);
    res.status(500).send('対象URLの取得に失敗しました: ' + error.message);
  }
});

/* 動作確認用のルート */
app.get('/', (req, res) => {
  res.send('Proxy Server is running!');
});

app.listen(PORT, () => {
  console.log(`Proxy Server running on port ${PORT}`);
});
