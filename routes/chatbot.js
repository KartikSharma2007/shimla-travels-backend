const express = require('express');
const router = express.Router();
const https = require('https');
const logger = require('../utils/logger');

const SYSTEM_PROMPT = `You are a friendly, knowledgeable travel assistant for Shimla Travels — a travel booking platform specialising in trips to Shimla, Himachal Pradesh, India.

Your role:
- Help users discover hotels, travel packages, and attractions in and around Shimla
- Answer questions about travel, booking, weather, best times to visit, and local tips
- Help users with their bookings, cancellations, and account questions
- Be warm, concise, and genuinely helpful

Key information about Shimla Travels:
- Website: shimla-travels.netlify.app
- Email: shimlaatravels@gmail.com
- Support phone: +919876543210
- Services: Hotel bookings, travel packages, guided tours, adventure activities
- Popular packages: Shimla sightseeing, Kufri day trip, Manali-Shimla combo, Spiti Valley, Chail
- Popular hotels: The Oberoi Cecil, Wildflower Hall, Radisson Blu, Hotel Combermere
- Top attractions: Mall Road, Jakhu Temple, Christ Church, Ridge, Kufri, Chail, Naldehra
- Best time to visit: March-June (summer, pleasant 15-25°C), Dec-Feb (snow, -5 to 10°C), avoid heavy monsoon Jul-Aug
- Payment: Demo mode — no real charges are processed on this platform

Personality:
- Friendly and enthusiastic about Shimla
- Concise — keep responses under 120 words unless the user asks for detail
- Use bullet points only when listing 3+ items
- Never make up specific prices or availability — direct users to browse the site
- If asked about something completely unrelated to travel, politely redirect`;

// POST /api/v1/chatbot/message
router.post('/message', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        logger.error('ANTHROPIC_API_KEY is not set in environment variables');
        return res.status(503).json({
            success: false,
            message: 'Chatbot service is not configured. Please add ANTHROPIC_API_KEY to your environment variables.',
        });
    }

    const payload = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
    });

    const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
                    const text = parsed.content?.[0]?.text ?? '';
                    return res.json({ success: true, reply: text });
                } else {
                    logger.error(`Anthropic API error ${proxyRes.statusCode}: ${data}`);
                    return res.status(502).json({
                        success: false,
                        message: 'AI service returned an error. Please try again.',
                    });
                }
            } catch (e) {
                logger.error(`Failed to parse Anthropic response: ${e.message}`);
                return res.status(502).json({ success: false, message: 'Invalid response from AI service.' });
            }
        });
    });

    proxyReq.on('error', (err) => {
        logger.error(`Anthropic proxy request failed: ${err.message}`);
        res.status(503).json({ success: false, message: 'Could not reach AI service. Please try again.' });
    });

    proxyReq.write(payload);
    proxyReq.end();
});

module.exports = router;