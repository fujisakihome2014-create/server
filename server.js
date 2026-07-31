const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 通常のウェブページを丸ごと取得してパスを書き換え、完全に表示させるエンドポイント
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

    // <base>タグを追加して、相対パスの基準をターゲットURLにする
    if ($('head').length > 0) {
      $('head').prepend(`<base href="${targetUrl}">`);
    } else {
      html = `<base href="${targetUrl}">` + html;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`プロキシ取得エラー: ${err.message}`);
  }
});

// 2. 画像やCSS、JSなどの静的アセットをそのままバイナリで中継するプロキシ
app.use('/proxy-asset', createProxyMiddleware({
  target: '/',
  router: (req) => req.query.url,
  changeOrigin: true,
  onProxyRes: (proxyRes) => {
    // 外部サイトがiframeを拒否するヘッダーを削除
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
