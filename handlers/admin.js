const bot = require('../config/bot');
const { setUser, getUser } = require('../database/users');
const { getPaymentById, setPayment } = require('../database/payments'); 
const { ADMIN_IDS, REFERRAL_REWARD } = require('../config/environment');
const { sendDailyStatsToAdmins } = require('../utils/notifications');
const StudentManagement = require('./studentManagement');
const MessageHelper = require('../utils/messageHelper');

// Admin Panel Command
const handleAdminPanel = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) { return; }

    const options = {
        reply_markup: {
            keyboard: MessageHelper.getAdminButtons(), // Fetched from MessageHelper
            resize_keyboard: true
        }
    };
    await bot.sendMessage(chatId, "👑 *Admin Panel*", { parse_mode: 'Markdown', ...options });
};

// NEW: Daily Stats Command
const handleDailyStatsCommand = async (msg) => {
    const chatId = msg.chat.id;
    if (!ADMIN_IDS.includes(msg.from.id)) { return; }
    await sendDailyStatsToAdmins(chatId);
};

// Helper function to handle referral rewarding
const processReferralReward = async (userId) => {
    const user = await getUser(userId);
    if (user?.referrerId) {
        const referrerId = parseInt(user.referrerId);
        const referrer = await getUser(referrerId);
        if (referrer) {
            referrer.referralCount = (referrer.referralCount || 0) + 1;
            referrer.rewards = (referrer.rewards || 0) + REFERRAL_REWARD;
            await setUser(referrerId, referrer);
            try {
                await bot.sendMessage(referrerId, `🎁 *CONGRATULATIONS!*\\n\\nYour referred student (*${user.name}*) has been verified, and you earned ${REFERRAL_REWARD} ETB.`, { parse_mode: 'Markdown' });
            } catch (e) { /* silent fail */ }
        }
    }
};

// NEW: Admin Approve Payment Logic
const handleAdminApprovePayment = async (callbackQuery) => {
    const adminId = callbackQuery.from.id;
    const paymentId = callbackQuery.data.split('_')[3];
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing Approval...' });
    if (!ADMIN_IDS.includes(adminId)) { return; }

    const payment = await getPaymentById(paymentId);
    if (!payment || payment.status !== 'pending') { return; }

    const userId = payment.userId;
    
    // 1. Update DB & User Status
    await setPayment(paymentId, { status: 'approved', approvedBy: adminId.toString(), approvalTimestamp: new Date().toISOString() });
    await setUser(userId, { isVerified: true, paymentStatus: 'approved', registrationStep: 'completed', joinedAt: new Date() });
    
    // 2. Process Referral Reward 
    await processReferralReward(userId);

    // 3. Notify User & Update Admin Message
    const newCaption = callbackQuery.message.caption + `\\n\\n✅ *APPROVED* by Admin ${adminId} on ${new Date().toLocaleTimeString()}`;
    await bot.editMessageCaption(newCaption, { 
        chat_id: callbackQuery.message.chat.id, 
        message_id: callbackQuery.message.message_id, 
        parse_mode: 'Markdown' 
    });
    try {
        await bot.sendMessage(userId, `🎉 *PAYMENT APPROVED!*\\n\\n✅ Your account is now verified and active!`, { parse_mode: 'Markdown' });
    } catch (e) { /* silent fail */ }
};

// NEW: Admin Reject Payment Logic
const handleAdminRejectPayment = async (callbackQuery) => {
    // ... (Similar logic to handleAdminApprovePayment, but sets user status to 'rejected' and sends rejection message)
};

module.exports = {
    handleAdminPanel,
    handleDailyStatsCommand,
    handleAdminApprovePayment,
    handleAdminRejectPayment,
    // ... (other admin handlers: /stats, /block, /unblock)
};
