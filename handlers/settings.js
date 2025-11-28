const { getBot } = require('../config/bot');
const bot = getBot();
const { ADMIN_IDS, MASTER_ADMIN_IDS, ConfigService } = require('../config/environment');
const MessageHelper = require('../utils/messageHelper');

// Settings editing state
const settingsState = new Map();

const SettingsHandler = {
    // Show settings dashboard
    async showSettingsDashboard(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            if (!ADMIN_IDS.includes(userId)) return;

            const config = await ConfigService.getAll();

            let dashboardText = 
                "🛠️ *BOT SETTINGS DASHBOARD*\n\n" +
                "Use */set [KEY] [VALUE]* to change settings.\n\n" +
                "*Example:* `/set registration_fee 600`\n\n";

            // Organize settings by category
            const categories = {
                '💰 Financial Settings': [
                    'registration_fee', 'referral_reward', 
                    'min_referrals_withdraw', 'min_withdrawal_amount'
                ],
                '⚡ Feature Toggles': [
                    'registration_enabled', 'referral_enabled', 
                    'withdrawal_enabled', 'tutorial_enabled', 
                    'trial_enabled', 'maintenance_mode'
                ],
                '📝 Message Settings': [
                    'welcome_message', 'start_message', 'reg_start',
                    'reg_name_saved', 'reg_phone_saved', 'reg_success'
                ]
            };

            for (const [category, keys] of Object.entries(categories)) {
                dashboardText += `*${category}:*\n`;
                keys.forEach(key => {
                    const value = String(config[key] || 'Not set');
                    dashboardText += `• ${key}: \`${value}\`\n`;
                });
                dashboardText += '\n';
            }

            await bot.sendMessage(chatId, dashboardText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: MessageHelper.getAdminButtons(),
                    resize_keyboard: true
                }
            });

        } catch (error) {
            console.error('❌ Settings dashboard error:', error);
            await bot.sendMessage(chatId, '❌ Error loading settings dashboard.');
        }
    },

    // Handle set command
    async handleSetCommand(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text.trim();

        try {
            if (!ADMIN_IDS.includes(userId)) return;

            const parts = text.split(/\s+/);
            if (parts.length < 2) {
                await bot.sendMessage(chatId, 
                    "❌ *Invalid Format*\n\n" +
                    "Usage: `/set [KEY] [VALUE]`\n\n" +
                    "*Examples:*\n" +
                    "• `/set registration_fee 600`\n" +
                    "• `/set maintenance_mode true`\n" +
                    "• `/set welcome_message` (for multi-line)",
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            const key = parts[1].toLowerCase();
            const value = parts.slice(2).join(' ').trim();

            // Get current config to validate key
            const config = await ConfigService.getAll();
            if (!(key in config)) {
                await bot.sendMessage(chatId, 
                    `❌ *Invalid Key*\n\n` +
                    `Key \`${key}\` not found in configuration.\n\n` +
                    `Use the settings dashboard to see available keys.`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Multi-line mode
            if (!value) {
                settingsState.set(userId, { key: key, mode: 'multi_line' });
                
                await bot.sendMessage(chatId,
                    `💬 *Multi-line Editing Mode*\n\n` +
                    `Editing key: \`${key}\`\n` +
                    `Current value: \`${config[key]}\`\n\n` +
                    `Please send the new value (can be multiple lines):\n\n` +
                    `*Send /cancel to exit editing mode.*`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Single-line mode
            const success = await ConfigService.set(key, value);
            await ConfigService.refresh();

            if (success) {
                await bot.sendMessage(chatId,
                    `✅ *Setting Updated*\n\n` +
                    `Key: \`${key}\`\n` +
                    `New Value: \`${value}\``,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await bot.sendMessage(chatId,
                    `❌ *Update Failed*\n\n` +
                    `Failed to update key \`${key}\`\n` +
                    `Please try again.`,
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error('❌ Set command error:', error);
            await bot.sendMessage(chatId, '❌ Error processing set command.');
        }
    },

    // Handle multi-line input
    async handleSetInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        try {
            const state = settingsState.get(userId);
            if (!state || state.mode !== 'multi_line') return;

            // Handle cancel
            if (text.toLowerCase() === '/cancel') {
                settingsState.delete(userId);
                await bot.sendMessage(chatId, '✅ Editing mode cancelled.', { parse_mode: 'Markdown' });
                return;
            }

            const success = await ConfigService.set(state.key, text);
            await ConfigService.refresh();

            settingsState.delete(userId);

            if (success) {
                await bot.sendMessage(chatId,
                    `✅ *Setting Updated*\n\n` +
                    `Key: \`${state.key}\`\n` +
                    `Value updated successfully.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await bot.sendMessage(chatId,
                    `❌ *Update Failed*\n\n` +
                    `Failed to update key \`${state.key}\``,
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error('❌ Set input error:', error);
            await bot.sendMessage(chatId, '❌ Error saving setting.');
        }
    },

    // Get editing state
    getEditingState(userId) {
        return settingsState.get(userId);
    }
};

module.exports = SettingsHandler;
