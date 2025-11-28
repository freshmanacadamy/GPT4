// handlers/main.js - MINIMAL DEBUG VERSION
const bot = require('../config/bot');

console.log('🔄 handlers/main.js LOADED');

const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    console.log(`📨 RAW MESSAGE: "${text}" from ${chatId}`);
    
    try {
        // Test if we can send ANY message
        console.log('🎯 Attempting to send basic response...');
        await bot.sendMessage(chatId, `🔍 DEBUG: You sent "${text}"`);
        console.log('✅ Basic response sent successfully');
        
        // Test button detection
        if (text === '📝 Register') {
            console.log('🎯 REGISTER BUTTON DETECTED - testing handler import...');
            try {
                const { handleRegisterTutorial } = require('./registration');
                console.log('✅ handleRegisterTutorial imported');
                await handleRegisterTutorial(msg);
            } catch (importError) {
                console.error('❌ HANDLER IMPORT FAILED:', importError.message);
                await bot.sendMessage(chatId, `❌ Handler error: ${importError.message}`);
            }
        }
        
    } catch (error) {
        console.error('💥 CRITICAL ERROR in handleMessage:', error.message);
        console.error('Full error:', error);
    }
};

const handleCallbackQuery = async (callbackQuery) => {
    console.log('🔄 Callback received:', callbackQuery.data);
    try {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Debug mode' });
    } catch (error) {
        console.error('Callback error:', error);
    }
};

module.exports = {
    handleMessage,
    handleCallbackQuery
};
