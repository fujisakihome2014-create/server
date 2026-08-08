import express from 'express';
const app = express();
const PORT = process.env.PORT || 10000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
            },
            redirect: 'follow'
        });

        const body = await response.text();
        const contentType = response.headers.get('content-type') || 'text/html';

        let modifiedBody = body;
        if (contentType.includes('text/html')) {
            const baseTag = `<base href="${targetUrl}">`;
            if (modifiedBody.includes('<head>')) {
                modifiedBody = modifiedBody.replace('<head>', `<head>${baseTag}`);
            } else if (modifiedBody.includes('<HEAD>')) {
                modifiedBody = modifiedBody.replace('<HEAD>', `<HEAD>${baseTag}`);
            } else {
                modifiedBody = baseTag + modifiedBody;
            }
        }

        res.set('Content-Type', contentType);
        res.send(modifiedBody);
    } catch (err) {
        res.status(500).send('Proxy Error: ' + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
