const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URLが指定されていません');

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    let html = await response.text();
    const $ = cheerio.load(html);

    // 相対パスのリンクや画像が正しく読み込めるように基準URLを設定
    if ($('head').length > 0) {
      $('head').prepend(`<base href="${targetUrl}">`);
    } else {
      html = `<base href="${targetUrl}">` + html;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Render取得エラー: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Render Proxy Server running on port ${PORT}`);
});
