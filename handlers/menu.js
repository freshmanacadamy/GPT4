const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const { REGISTRATION_FEE, REFERRAL_REWARD } = require('../config/environment');
const MessageHelper = require('../utils/messageHelper');

const MenuHandler = {
    // Show main menu
    async showMainMenu(chatId) {
        try {
            const user = await UserService.getUser(chatId);
            const isVerified = user?.isVerified || false;
            
            const keyboard = MessageHelper.getMainMenuButtons(isVerified);
            const welcomeMessage = MessageHelper.getMessage('WELCOME_MESSAGE', {
                fee: REGISTRATION_FEE,
                reward: REFERRAL_REWARD
            });

            await bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: keyboard,
                    resize_keyboard: true
                }
            });
        } catch (error) {
            console.error('❌ Error showing main menu:', error);
        }
    },

    // Show admin menu
    async showAdminMenu(chatId) {
        try {
            const keyboard = MessageHelper.getAdminButtons();
            
            await bot.sendMessage(chatId, "👑 *Admin Panel*", {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: keyboard,
                    resize_keyboard: true
                }
            });
        } catch (error) {
            console.error('❌ Error showing admin menu:', error);
        }
    }
};

module.exports = MenuHandler;
