process.loadEnvFile('./config.env');

import { createServer } from 'node:http';
import { router } from './routes/audio';

console.log("🚀 Starting pragmatical Node.js Server on http://localhost:8787");

const mockEnv = {
    AUTHENTICATION_ENABLED: process.env.AUTHENTICATION_ENABLED === 'true',
    AWS_POLLY_ENABLED: process.env.AWS_POLLY_ENABLED === 'true',
    API_KEYS: process.env.API_KEYS || 'm9NixGU7qtWv4SYr',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};

const server = createServer(async (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const fullUrl = `${protocol}://${req.headers.host}${req.url}`;
    
    // Globale CORS-Header für alle Eventualitäten (auch Optionen/Fehler)
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
        'Access-Control-Allow-Headers': '*',
    };

    // Preflight (OPTIONS) direkt abfangen für Browser-Extensions/Yomitan
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    const nativeHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
            if (Array.isArray(value)) {
                value.forEach(v => nativeHeaders.append(key, v));
            } else {
                nativeHeaders.set(key, value);
            }
        }
    }

    try {
        const urlObj = new URL(fullUrl);
        const nativeRequest = new Request(fullUrl, {
            method: req.method || 'GET',
            headers: nativeHeaders,
        });

        // itty-router v5 erwartet die Query-Parameter flach im Request-Kontext explizit übergeben
        const context = {
            ...mockEnv,
            query: Object.fromEntries(urlObj.searchParams.entries()),
        };

        const response: Response = await router.fetch(nativeRequest, context);

        if (response) {
            const responseHeaders: Record<string, string> = { ...corsHeaders };
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            res.writeHead(response.status, responseHeaders);
            
            if (response.body) {
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(Buffer.from(value));
                }
            }
            res.end();
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders });
            res.end('Not Found');
        }
    } catch (err: any) {
        console.error("🚨 Server Error:", err);
        res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ status: 500, error: err.message }));
    }
});

server.listen(8787, '0.0.0.0', () => {
    console.log("⭐ Server is listening on port 8787!");
});