// Backend/routes/chatbot.js
// Uses Groq API — FREE, no credit card, 14,400 requests/day
// Get free key: https://console.groq.com → API Keys → Create API Key
// Add to Render env vars: GROQ_API_KEY=your_key

const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are a friendly travel assistant for Shimla Travels, a booking platform for Shimla, Himachal Pradesh, India.

Key information:
- Website: shimla-travels.netlify.app
- Email: shimlaatravels@gmail.com, Phone: +919876543210  
- Services: Hotel bookings, travel packages, guided tours, adventure activities
- Popular packages: Shimla sightseeing, Kufri day trip, Manali-Shimla combo, Spiti Valley, Chail
- Popular hotels: The Oberoi Cecil, Wildflower Hall, Radisson Blu, Hotel Combermere
- Top attractions: Mall Road, Jakhu Temple, Christ Church, The Ridge, Kufri, Chail, Naldehra
- Best time to visit: March-June (pleasant, 15-25°C) or December-February (snow, -5 to 10°C)
- Avoid: July-August (heavy monsoon)
- Payments are demo mode only — no real charges processed

Rules:
- Be warm, helpful, and concise (under 120 words unless asked for detail)
- Use bullet points only when listing 3 or more items
- Never make up specific prices or availability
- If asked something unrelated to travel, politely redirect to Shimla travel topics`;

// ── GET /api/v1/chatbot/test ─────────────────────────────────────────────────
router.get('/test', async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        return res.json({
            status: 'ERROR',
            problem: 'GROQ_API_KEY is not set in Render environment variables',
            fix: 'Render dashboard → your backend → Environment → Add Variable: GROQ_API_KEY',
            getKey: 'https://console.groq.com → API Keys → Create API Key (free, no credit card)',
        });
    }

    const payload = JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: 'Say hello in one word.' }],
        max_tokens: 10,
    });

    const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    let responseData = '';
    let statusCode = 0;

    await new Promise((resolve) => {
        const testReq = https.request(options, (testRes) => {
            statusCode = testRes.statusCode;
            testRes.on('data', chunk => responseData += chunk);
            testRes.on('end', resolve);
        });
        testReq.on('error', (err) => { responseData = err.message; statusCode = 0; resolve(); });
        testReq.write(payload);
        testReq.end();
    });

    let parsed;
    try { parsed = JSON.parse(responseData); } catch { parsed = null; }

    if (statusCode === 200) {
        const reply = parsed?.choices?.[0]?.message?.content;
        return res.json({
            status: 'OK',
            message: 'Groq is working! Chatbot is ready.',
            groqReply: reply,
            model: 'llama3-8b-8192',
            keyPrefix: `${apiKey.substring(0, 8)}...`,
        });
    }

    const groqError = parsed?.error?.message || responseData;
    return res.json({
        status: 'ERROR',
        httpStatus: statusCode,
        groqError,
        keyPrefix: `${apiKey.substring(0, 8)}...`,
        fix: statusCode === 401 ? 'API key is invalid — check it at console.groq.com'
            : statusCode === 429 ? 'Rate limit — wait a minute and try again'
                : 'Check Render logs for more details',
    });
});

// ── POST /api/v1/chatbot/message ─────────────────────────────────────────────
router.post('/message', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            success: false,
            message: 'Chatbot not configured. Visit /api/v1/chatbot/test for setup help.',
        });
    }

    // Groq uses OpenAI-compatible format — easy!
    const payload = JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages, // already in { role, content } format from frontend
        ],
        max_tokens: 400,
        temperature: 0.7,
    });

    const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
            logger.info(`Groq response status: ${proxyRes.statusCode}`);

            try {
                const parsed = JSON.parse(data);

                if (proxyRes.statusCode === 200) {
                    const text = parsed?.choices?.[0]?.message?.content;
                    if (!text) {
                        logger.error(`Groq empty reply: ${JSON.stringify(parsed)}`);
                        return res.status(502).json({ success: false, message: 'AI returned empty response. Please try again.' });
                    }
                    return res.json({ success: true, reply: text });
                }

                const groqError = parsed?.error?.message || data;
                logger.error(`Groq error ${proxyRes.statusCode}: ${groqError}`);

                let userMessage = 'AI service error. Please try again.';
                if (proxyRes.statusCode === 401) userMessage = 'Chatbot API key is invalid.';
                if (proxyRes.statusCode === 429) userMessage = 'Too many requests. Please wait a moment and try again.';

                return res.status(502).json({ success: false, message: userMessage });
            } catch (e) {
                logger.error(`Groq parse error: ${e.message}`);
                return res.status(502).json({ success: false, message: 'Invalid AI response. Please try again.' });
            }
        });
    });

    proxyReq.on('error', (err) => {
        logger.error(`Groq network error: ${err.message}`);
        res.status(503).json({ success: false, message: 'Cannot reach AI service. Please try again.' });
    });

    proxyReq.write(payload);
    proxyReq.end();
});

module.exports = router;
