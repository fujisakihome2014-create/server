const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    // ここでCORSを全許可する
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL required');

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Bot判定回避用
        });
        const body = await response.text();
        res.set('Content-Type', response.headers.get('content-type') || 'text/html');
        res.send(body);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
