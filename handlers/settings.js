const bot = require('../config/bot');
const { ConfigService, ADMIN_IDS, refreshConfig } = require('../config/environment');
const MessageHelper = require('../utils/messageHelper');

// Store editing state: { userId: 'key_to_edit' }
const editingState = new Map();

class SettingsHandler {
    
    // --- Dashboard & Set Command Start ---
    static async showSettingsDashboard(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        if (!ADMIN_IDS.includes(userId)) { return; }

        const config = await ConfigService.getAll();

        // Dynamically build the dashboard text
        let dashboardText = 
            `🛠️ *BOT SETTINGS DASHBOARD*\\n\\n` +
            `Use the command */set [KEY] [VALUE]* to change a setting.\\n\n` +
            `Example: */set registration_fee 600*\\n\\n`;

        // Organize keys into categories for display
        const categories = {
            '💰 Financial': ['registration_fee', 'referral_reward', 'min_referrals_withdraw', 'min_withdrawal_amount'],
            '⚡ Feature Toggles': ['registration_enabled', 'referral_enabled', 'withdrawal_enabled', 'tutorial_enabled', 'trial_enabled', 'maintenance_mode'],
            '💬 Key Messages (Start typing value after /set KEY)': [
                'welcome_message', 'start_message', 'reg_start', 'reg_name_saved', 'reg_phone_saved', 'reg_success', 'maintenance_message',
            ]
        };

        for (const [category, keys] of Object.entries(categories)) {
            dashboardText += `*${category}:*\\n`;
            keys.forEach(key => {
                const value = String(config[key]); // Ensure boolean/number is a string for display
                dashboardText += `• ${key}: \`${value}\`\\n`;
            });
            dashboardText += '\\n';
        }

        await bot.sendMessage(chatId, dashboardText, { 
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: MessageHelper.getAdminButtons(), // Back to admin main
                resize_keyboard: true
            }
        });
    }

    static async handleSetCommand(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text.trim();

        if (!ADMIN_IDS.includes(userId)) { return; }

        const parts = text.split(/\s+/); // Split by whitespace
        if (parts.length < 2) {
            await bot.sendMessage(chatId, '❌ Invalid format. Use: */set [KEY] [VALUE]*', { parse_mode: 'Markdown' });
            return;
        }

        const key = parts[1].toLowerCase();
        const value = parts.slice(2).join(' ').trim();

        // If no value is provided, enter multi-line editing mode
        if (!value) {
            if (!ConfigService.DEFAULT_CONFIG[key]) {
                 await bot.sendMessage(chatId, `❌ Configuration key \`${key}\` not found.`, { parse_mode: 'Markdown' });
                 return;
            }
            editingState.set(userId, key);
            await bot.sendMessage(chatId, `💬 *Editing Mode Activated.*\\n\\nNow send the new multi-line value for key: \`${key}\`.\\n\\n*Send /cancel to exit editing mode.*`, { parse_mode: 'Markdown' });
            return;
        }
        
        // --- Immediate Key/Value Update ---
        if (!ConfigService.DEFAULT_CONFIG[key]) {
             await bot.sendMessage(chatId, `❌ Configuration key \`${key}\` not found.`, { parse_mode: 'Markdown' });
             return;
        }

        const success = await ConfigService.set(key, value);
        await refreshConfig(); // Reload the in-memory config

        if (success) {
            await bot.sendMessage(chatId, `✅ *SUCCESS!* Key \`${key}\` updated to: \`${value}\``, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, `❌ *ERROR!* Failed to save key \`${key}\` to database.`, { parse_mode: 'Markdown' });
        }
    }
    
    // --- Handle Multi-line Input ---
    static async handleSetInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;
        const key = editingState.get(userId);

        if (text.toLowerCase() === '/cancel') {
            editingState.delete(userId);
            await bot.sendMessage(chatId, '✅ Editing mode cancelled.', { parse_mode: 'Markdown' });
            return;
        }

        // Use \n to represent newlines in the database string
        const value = text.replace(/\n/g, '\\n'); 
        
        const success = await ConfigService.set(key, value);
        await refreshConfig(); // Reload the in-memory config

        editingState.delete(userId); // Exit editing mode

        if (success) {
            await bot.sendMessage(chatId, `✅ *SUCCESS!* Key \`${key}\` updated.`, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, `❌ *ERROR!* Failed to save key \`${key}\` to database.`, { parse_mode: 'Markdown' });
        }
    }

    // --- Utility Methods ---
    static getEditingState(userId) {
        return editingState.get(userId);
    }
}

module.exports = SettingsHandler;
