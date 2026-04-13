// Backend/routes/chatbot.js
// Uses Google Gemini 1.5 Flash (FREE — no credit card needed)
// Get key: https://aistudio.google.com/app/apikey
// Add to Render env vars: GEMINI_API_KEY=your_key

const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../utils/logger');

const SYSTEM_CONTEXT = `You are a friendly travel assistant for Shimla Travels — a booking platform for Shimla, Himachal Pradesh, India.

Key facts:
- Website: shimla-travels.netlify.app
- Email: shimlaatravels@gmail.com, Phone: +919876543210
- Services: Hotel bookings, travel packages, guided tours, adventure activities
- Popular packages: Shimla sightseeing, Kufri day trip, Manali-Shimla combo, Spiti Valley, Chail
- Popular hotels: The Oberoi Cecil, Wildflower Hall, Radisson Blu, Hotel Combermere
- Top attractions: Mall Road, Jakhu Temple, Christ Church, The Ridge, Kufri, Chail, Naldehra
- Best time: March-June (pleasant 15-25 degrees), Dec-Feb (snow, -5 to 10 degrees), avoid Jul-Aug monsoon
- Payments are demo mode only — no real charges

Be warm, concise (under 120 words), helpful. Use bullet points only for 3+ items. Never invent prices.`;

// POST /api/v1/chatbot/message
router.post('/message', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Clear error if key is missing
    if (!apiKey) {
        logger.error('GEMINI_API_KEY is not set in environment variables');
        return res.status(503).json({
            success: false,
            message: 'Chatbot not configured. Add GEMINI_API_KEY to Render environment variables. Get a free key at https://aistudio.google.com/app/apikey',
        });
    }

    // Build Gemini content array
    // Gemini uses "user" / "model" roles — no system role
    const contents = [
        { role: 'user', parts: [{ text: SYSTEM_CONTEXT }] },
        { role: 'model', parts: [{ text: 'Got it! I am the Shimla Travels assistant, ready to help.' }] },
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
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            // Log raw response for debugging
            logger.info(`Gemini status: ${proxyRes.statusCode}`);
            if (proxyRes.statusCode !== 200) {
                logger.error(`Gemini raw error response: ${data}`);
            }

            try {
                const parsed = JSON.parse(data);

                if (proxyRes.statusCode === 200) {
                    const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) {
                        logger.error(`Gemini empty reply. Full response: ${JSON.stringify(parsed)}`);
                        return res.status(502).json({ success: false, message: 'AI returned an empty response. Please try again.' });
                    }
                    return res.json({ success: true, reply: text });
                }

                // Gemini returned an error — forward the actual message
                const geminiError = parsed?.error?.message || parsed?.error?.status || data;
                logger.error(`Gemini API error ${proxyRes.statusCode}: ${geminiError}`);

                // Map common Gemini errors to user-friendly messages
                let userMessage = 'AI service error. Please try again.';
                if (proxyRes.statusCode === 400) userMessage = 'Invalid request to AI service. Check your API key is correct.';
                if (proxyRes.statusCode === 401 || proxyRes.statusCode === 403) userMessage = 'Gemini API key is invalid or expired. Please check GEMINI_API_KEY on Render.';
                if (proxyRes.statusCode === 429) userMessage = 'AI service rate limit reached. Please wait a moment and try again.';

                return res.status(502).json({ success: false, message: userMessage, detail: geminiError });
            } catch (e) {
                logger.error(`Failed to parse Gemini response: ${e.message}. Raw: ${data.substring(0, 200)}`);
                return res.status(502).json({ success: false, message: 'Invalid response from AI service.' });
            }
        });
    });

    proxyReq.on('error', (err) => {
        logger.error(`Gemini network error: ${err.message}`);
        res.status(503).json({ success: false, message: 'Could not reach AI service. Please try again.' });
    });

    proxyReq.write(payload);
    proxyReq.end();
});

module.exports = router;
