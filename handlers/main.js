// handlers/main.js - BASIC WORKING VERSION
const bot = require('../config/bot');
const { showMainMenu } = require('./menu');
const { handleHelp } = require('./help');

console.log('✅ handlers/main.js loaded');

// Main message handler
const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';
    
    console.log(`💬 Message from ${userId}: "${text}"`);
    
    try {
        // Handle commands
        if (text.startsWith('/')) {
            switch (text) {
                case '/start':
                    console.log('🔄 Processing /start command');
                    await bot.sendMessage(chatId, 
                        '🎉 Welcome to Tutorial Registration Bot!\\n\\n' +
                        '✅ Full bot is working!\\n' +
                        '📚 Register for comprehensive tutorials\\n' +
                        '💰 Easy payment process\\n' +
                        '🎁 Earn referral rewards\\n\\n' +
                        'Choose an option below:',
                        { parse_mode: 'Markdown' }
                    );
                    await showMainMenu(chatId);
                    break;
                    
                case '/help':
                case '❓ Help':
                    await handleHelp(msg);
                    break;
                    
                case '/menu':
                    await showMainMenu(chatId);
                    break;
                    
                default:
                    await showMainMenu(chatId);
            }
        } else {
            // Handle button clicks
            switch (text) {
                case '📝 Register':
                    await bot.sendMessage(chatId, 
                        '📝 Registration System\\n\\n' +
                        'This feature will be available soon!\\n' +
                        'Currently in development...',
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case '💰 Pay Fee':
                    await bot.sendMessage(chatId, 
                        '💰 Payment System\\n\\n' +
                        'This feature will be available soon!\\n' +
                        'Currently in development...',
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case '🎁 Invite & Earn':
                    await bot.sendMessage(chatId, 
                        '🎁 Referral System\\n\\n' +
                        'This feature will be available soon!\\n' +
                        'Currently in development...',
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case '👤 My Profile':
                    await bot.sendMessage(chatId, 
                        '👤 Profile System\\n\\n' +
                        'This feature will be available soon!\\n' +
                        'Currently in development...',
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case '📌 Rules':
                    await bot.sendMessage(chatId, 
                        '📌 Rules & Guidelines\\n\\n' +
                        '• Be respectful\\n' +
                        '• Follow instructions\\n' +
                        '• No spam allowed\\n' +
                        '• Enjoy learning!',
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case '📚 Free Trial':
                    await bot.sendMessage(chatId, 
                        '📚 Trial Materials\\n\\n' +
                        'Free trial content coming soon!\\n' +
                        'Check back later for updates.',
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                default:
                    await bot.sendMessage(chatId, 
                        `You said: "${text}"\\n\\nUse the menu buttons or send /help.`,
                        { parse_mode: 'Markdown' }
                    );
            }
        }
        
    } catch (error) {
        console.error('❌ ERROR in handleMessage:', error);
        console.error('Error stack:', error.stack);
        
        try {
            await bot.sendMessage(chatId, 
                `❌ Error: ${error.message}\\n\\nPlease try again.`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            console.error('Could not send error message:', e);
        }
    }
};

// Callback handler
const handleCallbackQuery = async (callbackQuery) => {
    console.log('🔄 Callback received:', callbackQuery.data);
    try {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Feature coming soon!' });
    } catch (error) {
        console.error('Callback error:', error);
    }
};

module.exports = {
    handleMessage,
    handleCallbackQuery
};
