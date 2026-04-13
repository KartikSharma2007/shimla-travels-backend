// Backend/routes/chatbot.js
// Uses Google Gemini 1.5 Flash (FREE)
// Get key: https://aistudio.google.com/app/apikey
// Add to Render env vars: GEMINI_API_KEY=your_key

const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../utils/logger');

const SYSTEM_CONTEXT = `You are a friendly travel assistant for Shimla Travels, a booking platform for Shimla, Himachal Pradesh, India. Help users with hotels, packages, attractions, weather, and travel tips. Be warm and concise (under 120 words). Key info: best time March-June (15-25C) or Dec-Feb (snow). Top spots: Mall Road, Jakhu Temple, Kufri, The Ridge. Email: shimlaatravels@gmail.com`;

// ── GET /api/v1/chatbot/test — browser-accessible diagnostic ─────────────────
// Visit: https://your-backend.onrender.com/api/v1/chatbot/test
// Shows exactly what's wrong without needing to check logs
router.get('/test', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.json({
            status: 'ERROR',
            problem: 'GEMINI_API_KEY is not set in your Render environment variables',
            fix: 'Go to Render → your backend service → Environment → Add Variable → GEMINI_API_KEY = your key',
            getKey: 'https://aistudio.google.com/app/apikey',
        });
    }

    // Try a minimal Gemini request
    const payload = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello in one word.' }] }],
        generationConfig: { maxOutputTokens: 10 },
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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
        testReq.on('error', (err) => {
            responseData = err.message;
            statusCode = 0;
            resolve();
        });
        testReq.write(payload);
        testReq.end();
    });

    let parsed;
    try { parsed = JSON.parse(responseData); } catch { parsed = null; }

    if (statusCode === 200) {
        const reply = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        return res.json({
            status: 'OK',
            message: 'Gemini is working correctly!',
            geminiReply: reply,
            keyPrefix: `${apiKey.substring(0, 8)}...`,
        });
    }

    const geminiError = parsed?.error?.message || parsed?.error?.status || responseData;

    return res.json({
        status: 'ERROR',
        httpStatus: statusCode,
        geminiError,
        keyPrefix: `${apiKey.substring(0, 8)}...`,
        fix: statusCode === 400 ? 'API key format looks wrong — make sure you copied the full key from aistudio.google.com/app/apikey'
            : statusCode === 401 || statusCode === 403 ? 'API key is invalid or has been revoked — generate a new one at aistudio.google.com/app/apikey'
                : statusCode === 429 ? 'Rate limit hit — wait 60 seconds and try again'
                    : `Unexpected error — check Render logs for details`,
    });
});

// ── POST /api/v1/chatbot/message ─────────────────────────────────────────────
router.post('/message', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            success: false,
            message: 'Chatbot not configured. Visit /api/v1/chatbot/test for setup instructions.',
        });
    }

    const contents = [
        { role: 'user', parts: [{ text: SYSTEM_CONTEXT }] },
        { role: 'model', parts: [{ text: 'Ready to help with Shimla travel!' }] },
        ...messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
        })),
    ];

    const payload = JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
            logger.info(`Gemini response status: ${proxyRes.statusCode}`);

            try {
                const parsed = JSON.parse(data);

                if (proxyRes.statusCode === 200) {
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) {
                        logger.error(`Gemini empty reply: ${JSON.stringify(parsed)}`);
                        return res.status(502).json({ success: false, message: 'AI returned empty response. Please try again.' });
                    }
                    return res.json({ success: true, reply: text });
                }

                const geminiError = parsed?.error?.message || parsed?.error?.status || data;
                logger.error(`Gemini error ${proxyRes.statusCode}: ${geminiError}`);

                let userMessage = 'AI service error. Please try again.';
                if (proxyRes.statusCode === 401 || proxyRes.statusCode === 403) {
                    userMessage = 'Chatbot API key is invalid. Visit /api/v1/chatbot/test for help.';
                } else if (proxyRes.statusCode === 429) {
                    userMessage = 'Too many requests. Please wait a moment and try again.';
                } else if (proxyRes.statusCode === 400) {
                    userMessage = 'Bad request to AI service. Check /api/v1/chatbot/test for diagnosis.';
                }

                return res.status(502).json({ success: false, message: userMessage });
            } catch (e) {
                logger.error(`Parse error: ${e.message}. Raw: ${data.substring(0, 300)}`);
                return res.status(502).json({ success: false, message: 'Invalid AI response. Please try again.' });
            }
        });
    });

    proxyReq.on('error', (err) => {
        logger.error(`Gemini network error: ${err.message}`);
        res.status(503).json({ success: false, message: 'Cannot reach AI service. Please try again.' });
    });

    proxyReq.write(payload);
    proxyReq.end();
});

module.exports = router;
