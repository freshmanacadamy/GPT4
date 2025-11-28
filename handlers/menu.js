// handlers/menu.js - DEBUG VERSION
const bot = require('../config/bot');

const showMainMenu = async (chatId) => {
    console.log(`🔄 showMainMenu called for ${chatId}`);
    
    try {
        // Test each dependency one by one
        console.log('1. Testing database getUser...');
        const { getUser } = require('../database/users');
        const user = await getUser(chatId);
        console.log('✅ getUser worked:', user ? 'User found' : 'No user');
        
        console.log('2. Testing MessageHelper...');
        const MessageHelper = require('../utils/messageHelper');
        console.log('✅ MessageHelper loaded');
        
        console.log('3. Testing environment...');
        const { REGISTRATION_FEE, REFERRAL_REWARD } = require('../config/environment');
        console.log('✅ Environment loaded');
        
        console.log('4. Testing helpers...');
        const { formatCurrency } = require('../utils/helpers');
        console.log('✅ Helpers loaded');
        
        console.log('5. Testing menu buttons...');
        const isVerified = user?.isVerified || false;
        const keyboard = MessageHelper.getMainMenuButtons(isVerified);
        console.log('✅ Menu buttons generated');
        
        console.log('6. Testing message generation...');
        const welcomeMessage = MessageHelper.getMessage(
            'WELCOME_MESSAGE',
            {
                fee: formatCurrency(REGISTRATION_FEE),
                reward: formatCurrency(REFERRAL_REWARD)
            }
        );
        console.log('✅ Message generated');
        
        const options = {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true
            }
        };
        
        console.log('7. Sending message...');
        await bot.sendMessage(chatId, welcomeMessage, { 
            parse_mode: 'Markdown', 
            ...options 
        });
        
        console.log('✅ Menu sent successfully');
        
    } catch (error) {
        console.error('❌ ERROR in showMainMenu:', error);
        console.error('Error stack:', error.stack);
        
        // Fallback: send simple menu
        const fallbackOptions = {
            reply_markup: {
                keyboard: [
                    [{ text: '📝 Register' }, { text: '💰 Pay Fee' }],
                    [{ text: '🎁 Invite & Earn' }, { text: '👤 My Profile' }],
                    [{ text: '📚 Free Trial' }],
                    [{ text: '📌 Rules' }, { text: '❓ Help' }]
                ],
                resize_keyboard: true
            }
        };
        
        await bot.sendMessage(chatId, 
            '🏠 *Main Menu*\\n\\nChoose an option below:',
            { parse_mode: 'Markdown', ...fallbackOptions }
        );
        
        console.log('✅ Fallback menu sent');
    }
};

module.exports = { showMainMenu };
