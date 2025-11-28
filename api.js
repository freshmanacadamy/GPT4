// api-simple.js - Simplified version for testing
const TelegramBot = require('node-telegram-bot-api');

// Global error handlers
process.on('unhandledRejection', (error) => {
    console.error('🔴 Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
});

module.exports = async (req, res) => {
    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle GET requests (Health Check)
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'online',
            message: 'Bot is running (Simplified Version)',
            timestamp: new Date().toISOString()
        });
    }

    // Handle POST requests (Telegram webhook)
    if (req.method === 'POST') {
        try {
            const update = req.body;
            
            if (!update || !update.update_id) {
                return res.status(400).json({ error: 'Invalid update' });
            }

            console.log(`📨 Update received: ${update.update_id}`);
            
            // Quick response without processing
            return res.status(200).json({ 
                ok: true,
                update_id: update.update_id
            });

        } catch (error) {
            console.error('❌ Error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
