// api-simple.js - Fixed version that actually responds
const TelegramBot = require('node-telegram-bot-api');

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN);

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
            message: 'Bot is running and WILL respond to messages!',
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
            
            // Process the message and respond to user
            if (update.message) {
                const chatId = update.message.chat.id;
                const text = update.message.text;
                
                console.log(`💬 Message from ${chatId}: ${text}`);
                
                // Send actual response to user
                if (text === '/start') {
                    await bot.sendMessage(chatId, '🎉 Welcome! Bot is working! Send me any message.');
                } else {
                    await bot.sendMessage(chatId, `You said: "${text}"`);
                }
                
                console.log(`✅ Replied to ${chatId}`);
            }
            
            // Quick response to Telegram
            return res.status(200).json({ 
                ok: true,
                update_id: update.update_id,
                message: 'Update processed and replied to user'
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
