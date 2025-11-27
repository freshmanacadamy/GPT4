const bot = require('../config/bot');
const { getUser } = require('../database/users');
const { REGISTRATION_FEE, REFERRAL_REWARD } = require('../config/environment');
const MessageHelper = require('../utils/messageHelper');
const { formatCurrency } = require('../utils/helpers');

const showMainMenu = async (chatId) => {
    const user = await getUser(chatId);
    
    // Check if user is verified to decide which buttons to show
    const isVerified = user?.isVerified || false;
    const keyboard = MessageHelper.getMainMenuButtons(isVerified);

    const options = {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true
        }
    };
    
    // Fetch message dynamically, replacing placeholders
    const welcomeMessage = MessageHelper.getMessage(
        'WELCOME_MESSAGE', // Key from environment.js
        {
            fee: formatCurrency(REGISTRATION_FEE),
            reward: formatCurrency(REFERRAL_REWARD)
        }
    );
    
    await bot.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown', 
        ...options 
    });
};

module.exports = { showMainMenu };
