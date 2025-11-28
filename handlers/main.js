// handlers/main.js - DEBUG VERSION
const bot = require('../config/bot');
const { getUser } = require('../database/users');

console.log('✅ handlers/main.js loaded');

// Main message handler - SIMPLIFIED FOR DEBUGGING
const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';
    
    console.log(`💬 Message from ${userId}: "${text}"`);
    
    try {
        // SIMPLE RESPONSE FOR TESTING
        if (text === '/start') {
            console.log('🔄 Processing /start command');
            await bot.sendMessage(chatId, 
                '🎉 Welcome to the Tutorial Bot!\\n\\n' +
                '✅ Bot is working!\\n' +
                '🔧 Testing basic functionality...\\n\\n' +
                'Try these commands:\\n' +
                '• /help - Show help\\n' +
                '• /menu - Show main menu',
                { parse_mode: 'Markdown' }
            );
            console.log('✅ /start response sent successfully');
            return;
        }
        
        // Default response for other messages
        await bot.sendMessage(chatId, 
            `You said: "${text}"\\n\\nSend /start to begin.`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ ERROR in handleMessage:', error);
        console.error('Error stack:', error.stack);
        
        // Try to send a simple error message
        try {
            await bot.sendMessage(chatId, 
                `❌ Error details:\\n\\n${error.message}`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            console.error('Could not send error message:', e);
        }
    }
};

// Simple callback handler for now
const handleCallbackQuery = async (callbackQuery) => {
    console.log('🔄 Callback received:', callbackQuery.data);
    try {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Feature not ready yet' });
    } catch (error) {
        console.error('Callback error:', error);
    }
};

module.exports = {
    handleMessage,
    handleCallbackQuery
};
