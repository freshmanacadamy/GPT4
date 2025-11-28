// handlers/main.js - Main message router for the bot
const bot = require('../config/bot');
const { getUser } = require('../database/users');

// Import all handlers
const { handleRegisterTutorial, handleNameInput, handleContactShared, handleNavigation, handleRegistrationCallback } = require('./registration');
const { handlePayFee, handlePaymentScreenshot } = require('./payment');
const { handleMyProfile, handleProfileText, handleProfileCallback } = require('./profile');
const { handleInviteEarn, handleLeaderboard, handleMyReferrals, handleReferralStart } = require('./referral');
const { handleHelp, handleRules } = require('./help');
const { handleAdminPanel, handleDailyStatsCommand, handleAdminApprovePayment, handleAdminRejectPayment } = require('./admin');
const { showMainMenu } = require('./menu');
const { handleTrialMaterials, handleViewTrialMaterial } = require('./trial');

// Main message handler
const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';
    
    console.log(`💬 Message from ${userId}: ${text}`);
    
    try {
        // Handle photo messages (payment screenshots)
        if (msg.photo) {
            await handlePaymentScreenshot(msg);
            return;
        }
        
        // Handle contact sharing
        if (msg.contact) {
            await handleContactShared(msg);
            return;
        }

        // Handle commands and text messages
        if (text.startsWith('/')) {
            switch (text) {
                case '/start':
                    // Handle referral start first
                    const referrerId = await handleReferralStart(msg);
                    if (referrerId) {
                        console.log(`✅ Referral recorded: ${userId} referred by ${referrerId}`);
                    }
                    await showMainMenu(chatId);
                    break;
                case '/help':
                case '❓ Help':
                    await handleHelp(msg);
                    break;
                case '/admin':
                    await handleAdminPanel(msg);
                    break;
                case '/dailystats':
                    await handleDailyStatsCommand(msg);
                    break;
                case '/menu':
                    await showMainMenu(chatId);
                    break;
                default:
                    await showMainMenu(chatId);
            }
        } else {
            // Handle button clicks and regular messages
            switch (text) {
                case '📝 Register':
                    await handleRegisterTutorial(msg);
                    break;
                case '💰 Pay Fee':
                    await handlePayFee(msg);
                    break;
                case '🎁 Invite & Earn':
                    await handleInviteEarn(msg);
                    break;
                case '🏆 Leaderboard':
                    await handleLeaderboard(msg);
                    break;
                case '👤 My Profile':
                    await handleMyProfile(msg);
                    break;
                case '📌 Rules':
                    await handleRules(msg);
                    break;
                case '❓ Help':
                    await handleHelp(msg);
                    break;
                case '📚 Free Trial':
                    await handleTrialMaterials(msg);
                    break;
                default:
                    // Handle registration flow and other states
                    if (await handleNavigation(msg)) return;
                    if (await handleProfileText(msg)) return;
                    
                    // Handle name input for registration
                    await handleNameInput(msg);
            }
        }
    } catch (error) {
        console.error('❌ Error in handleMessage:', error);
        try {
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
};

// Callback query handler
const handleCallbackQuery = async (callbackQuery) => {
    const data = callbackQuery.data;
    const message = callbackQuery.message;
    
    console.log(`🔄 Callback: ${data}`);
    
    try {
        // Route to appropriate handler
        if (data.startsWith('admin_')) {
            if (data.startsWith('admin_approve_payment_')) {
                await handleAdminApprovePayment(callbackQuery);
            } else if (data.startsWith('admin_reject_payment_')) {
                // await handleAdminRejectPayment(callbackQuery);
            }
        } else if (data.startsWith('stream_') || data.startsWith('payment_')) {
            await handleRegistrationCallback(callbackQuery);
        } else if (data.startsWith('profile_') || data.startsWith('payment_update_')) {
            await handleProfileCallback(callbackQuery);
        } else if (data === 'leaderboard') {
            await handleLeaderboard({ chatId: message.chat.id, from: callbackQuery.from });
        } else if (data === 'my_referrals') {
            await handleMyReferrals({ chatId: message.chat.id, from: callbackQuery.from });
        } else if (data.startsWith('trial_view_')) {
            await handleViewTrialMaterial(callbackQuery);
        } else if (data === 'students_back_to_main') {
            // Handle student management navigation
            await bot.deleteMessage(message.chat.id, message.message_id);
            await handleAdminPanel({ chatId: message.chat.id, from: callbackQuery.from });
        }
        
        // Answer all callback queries
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('❌ Error in handleCallbackQuery:', error);
        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing request' });
        } catch (e) {
            console.error('Failed to answer callback:', e);
        }
    }
};

module.exports = {
    handleMessage,
    handleCallbackQuery
};
