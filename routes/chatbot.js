// Backend/routes/chatbot.js
//
// Chatbot proxy — uses Google Gemini API (FREE tier, no credit card needed).
// Get your free API key at: https://aistudio.google.com/app/apikey
// Add to your .env: GEMINI_API_KEY=your_key_here
// Also add on Render dashboard under Environment Variables.

const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../utils/logger');

const SYSTEM_CONTEXT = `You are a friendly, knowledgeable travel assistant for Shimla Travels — a travel booking platform for trips to Shimla, Himachal Pradesh, India.

Key facts:
- Website: shimla-travels.netlify.app
- Email: shimlaatravels@gmail.com  
- Phone: +919876543210
- Services: Hotel bookings, travel packages, guided tours, adventure activities
- Popular packages: Shimla sightseeing, Kufri day trip, Manali-Shimla combo, Spiti Valley, Chail
- Popular hotels: The Oberoi Cecil, Wildflower Hall, Radisson Blu, Hotel Combermere
- Top attractions: Mall Road, Jakhu Temple, Christ Church, The Ridge, Kufri, Chail, Naldehra
- Best time: March-June (pleasant 15-25°C), Dec-Feb (snow -5 to 10°C), avoid Jul-Aug monsoon
- Payments are demo mode — no real charges

Rules:
- Be warm, helpful, concise (under 120 words unless asked for detail)
- Use bullet points only for 3+ items
- Never make up prices or availability
- If asked something unrelated to travel, politely redirect`;

// POST /api/v1/chatbot/message
router.post('/message', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error('GEMINI_API_KEY is not set');
        return res.status(503).json({
            success: false,
            message: 'Chatbot is not configured. Please add GEMINI_API_KEY to your environment variables. Get a free key at https://aistudio.google.com/app/apikey',
        });
    }

    // Convert messages to Gemini format
    // Gemini uses "user" and "model" roles (not "assistant")
    const geminiContents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    // Prepend system context as a user/model pair (Gemini doesn't have a system role)
    const contentsWithSystem = [
        { role: 'user', parts: [{ text: SYSTEM_CONTEXT }] },
        { role: 'model', parts: [{ text: 'Understood! I am the Shimla Travels assistant, ready to help.' }] },
        ...geminiContents,
    ];

    const payload = JSON.stringify({
        contents: contentsWithSystem,
        generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.7,
        },
    });

    const path = `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path,
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
            try {
                const parsed = JSON.parse(data);
                if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                    if (!text) {
                        logger.error('Gemini returned empty response');
                        return res.status(502).json({ success: false, message: 'AI returned an empty response. Please try again.' });
                    }
                    return res.json({ success: true, reply: text });
                } else {
                    const errMsg = parsed?.error?.message || data;
                    logger.error(`Gemini API error ${proxyRes.statusCode}: ${errMsg}`);
                    return res.status(502).json({ success: false, message: 'AI service error. Please try again.' });
                }
            } catch (e) {
                logger.error(`Failed to parse Gemini response: ${e.message}`);
                return res.status(502).json({ success: false, message: 'Invalid response from AI service.' });
            }
        });
    });

    proxyReq.on('error', (err) => {
        logger.error(`Gemini proxy request failed: ${err.message}`);
        res.status(503).json({ success: false, message: 'Could not reach AI service. Please try again.' });
    });

    proxyReq.write(payload);
    proxyReq.end();
});

module.exports = router;
