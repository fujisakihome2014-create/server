const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
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
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            }
        });
        
        let body = await response.text();
        const contentType = response.headers.get('content-type') || 'text/html';

        // HTMLの場合、相対パスのリンク・画像・CSSが崩れないように <base> タグを自動挿入
        if (contentType.includes('text/html')) {
            const baseTag = `<base href="${targetUrl}">`;
            if (body.includes('<head>')) {
                body = body.replace('<head>', `<head>${baseTag}`);
            } else if (body.includes('<HEAD>')) {
                body = body.replace('<HEAD>', `<HEAD>${baseTag}`);
            } else {
                body = baseTag + body;
            }
        }

        res.set('Content-Type', contentType);
        res.send(body);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
