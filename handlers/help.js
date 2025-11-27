const bot = require('../config/bot');
const { ADMIN_IDS } = require('../config/environment');
const MessageHelper = require('../utils/messageHelper');

const handleHelp = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isAdmin = ADMIN_IDS.includes(userId);

    let helpMessage = 
        `❓ *HELP & SUPPORT*\\n\\n` +
        `📚 *Registration Process:*\\n` +
        `1. Tap '📝 Register' and follow the steps.\\n` +
        `2. Tap '💰 Pay Fee' to get payment instructions and upload your receipt.\\n` +
        `3. Wait for admin approval to gain full access.\\n\\n` +
        `🎁 *Referral System:*\\n` +
        `• Share your link from '🎁 Invite & Earn'.\\n` +
        `• Earn rewards when your referral is verified.\\n` +
        `• Track stats on the '🏆 Leaderboard' and '👤 My Profile'.\\n\\n` +
        `📌 *Need More Assistance?*\\n` +
        `Please contact an administrator directly for support.`;

    if (isAdmin) {
        helpMessage += `\\n\\n⚡ *ADMIN PANEL ACCESS:*\\n` +
            `/admin - Open the Admin Dashboard\\n` +
            `/dailystats - Get an immediate report on new user counts\\n` +
            `/set KEY VALUE - Dynamically change any text or fee (e.g., /set registration_fee 600)`;
    }

    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
};

const handleRules = async (msg) => {
    const chatId = msg.chat.id;

    const rulesMessage = 
        `📌 *RULES & GUIDELINES*\\n\\n` +
        `✅ *Registration:*\\n` +
        `• All information must be accurate.\\n` +
        `• Payment receipts must be clear and legible.\\n\\n` +
        `🎁 *Referral System:*\\n` +
        `• Only genuine referrals are rewarded.\\n` +
        `• Self-referral or the use of fake accounts will result in account suspension.\\n\\n` +
        `⚠️ *Prohibited Actions:*\\n` +
        `• Spamming the bot or administrators.\\n` +
        `• Abusive language.\\n` +
        `• Repeatedly uploading fake payment proof.`;

    await bot.sendMessage(chatId, rulesMessage, { parse_mode: 'Markdown' });
};

module.exports = {
    handleHelp,
    handleRules
};
