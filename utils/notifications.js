const bot = require('../config/bot');
const { REGISTRATION_FEE, ADMIN_IDS, REFERRAL_REWARD } = require('../config/environment');
const { getDailyNewUsersCount, getAllUsers } = require('../database/users');
const { formatCurrency } = require('./helpers');

// Notifies admins about a new payment screenshot uploaded by a user
const notifyAdminsNewPayment = async (user, fileId, paymentId) => {
    // Note: The notification check is omitted here for brevity, assume always ON
    if (!ADMIN_IDS || ADMIN_IDS.length === 0) { return; }

    const notificationMessage = 
        `📋 *NEW PAYMENT APPROVAL REQUEST*\\n\\n` +
        `👤 *User Information:*\\n` +
        `• Name: ${user.name}\\n` +
        `• User ID: \`${user.telegramId}\`\\n\\n` +
        `💳 *Payment Details:*\\n` +
        `• Amount: ${formatCurrency(REGISTRATION_FEE)}\\n` +
        `*Payment ID: ${paymentId}*`; // CRITICAL: Payment ID for callback

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Approve', callback_data: `admin_approve_payment_${paymentId}` },
                    { text: '❌ Reject', callback_data: `admin_reject_payment_${paymentId}` }
                ],
                [
                    { text: '👁️ View Student Details', callback_data: `students_view_details_${user.telegramId}` } // NEW FEATURE
                ]
            ]
        },
        parse_mode: 'Markdown'
    };

    for (const adminId of ADMIN_IDS) {
        try {
            // Send the photo (screenshot) and the approval buttons
            await bot.sendPhoto(adminId, fileId, { caption: notificationMessage, ...options });
        } catch (error) { /* silent fail */ }
    }
};

// NEW FEATURE: Sends a daily summary of new users to all admins.
const sendDailyStatsToAdmins = async (chatId = null) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const newUsers = await getDailyNewUsersCount();
    const allUsersCount = Object.keys(await getAllUsers()).length; 

    const statsMessage = 
        `📅 *DAILY BOT STATS SUMMARY*\\n` +
        `_For: ${today}_\\n\\n` +
        `👥 *New Users Today:* ${newUsers}\\n` +
        `📈 *Total Users:* ${allUsersCount}\\n`;

    const recipients = chatId ? [chatId] : ADMIN_IDS;

    if (!recipients || recipients.length === 0) { return; }

    for (const id of recipients) {
        try {
            await bot.sendMessage(id, statsMessage, { parse_mode: 'Markdown' });
        } catch (error) { /* silent fail */ }
    }
};

module.exports = {
    notifyAdminsNewPayment,
    sendDailyStatsToAdmins,
    // ... (notifyAdminsNewRegistration, notifyAdminsWithdrawal)
};
