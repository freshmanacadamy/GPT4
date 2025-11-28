// handlers/main.js - FIXED VERSION
const bot = require('../config/bot');

// Import handlers - DEFER LOADING TO AVOID CIRCULAR DEPENDENCIES
const getRegistrationHandlers = () => require('./registration');
const getPaymentHandlers = () => require('./payment');
const getProfileHandlers = () => require('./profile');
const getReferralHandlers = () => require('./referral');
const getHelpHandlers = () => require('./help');
const getAdminHandlers = () => require('./admin');
const getMenuHandlers = () => require('./menu');
const getTrialHandlers = () => require('./trial');

// Main message handler
const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';
    
    console.log(`💬 Message from ${userId}: "${text}"`);
    
    try {
        // Handle photo messages (payment screenshots)
        if (msg.photo) {
            const { handlePaymentScreenshot } = getPaymentHandlers();
            await handlePaymentScreenshot(msg);
            return;
        }
        
        // Handle contact sharing
        if (msg.contact) {
            const { handleContactShared } = getRegistrationHandlers();
            await handleContactShared(msg);
            return;
        }

        // Handle commands and text messages
        if (text.startsWith('/')) {
            switch (text) {
                case '/start':
                    const { handleReferralStart } = getReferralHandlers();
                    await handleReferralStart(msg);
                    const { showMainMenu } = getMenuHandlers();
                    await showMainMenu(chatId);
                    break;
                    
                case '/help':
                case '❓ Help':
                    const { handleHelp } = getHelpHandlers();
                    await handleHelp(msg);
                    break;
                    
                case '/admin':
                    const { handleAdminPanel } = getAdminHandlers();
                    await handleAdminPanel(msg);
                    break;
                    
                case '/dailystats':
                    const { handleDailyStatsCommand } = getAdminHandlers();
                    await handleDailyStatsCommand(msg);
                    break;
                    
                case '/menu':
                    const { showMainMenu } = getMenuHandlers();
                    await showMainMenu(chatId);
                    break;
                    
                default:
                    const { showMainMenu } = getMenuHandlers();
                    await showMainMenu(chatId);
            }
        } else {
            // Handle button clicks and regular messages
            switch (text) {
                case '📝 Register':
                    const { handleRegisterTutorial } = getRegistrationHandlers();
                    await handleRegisterTutorial(msg);
                    break;
                    
                case '💰 Pay Fee':
                    const { handlePayFee } = getPaymentHandlers();
                    await handlePayFee(msg);
                    break;
                    
                case '🎁 Invite & Earn':
                    const { handleInviteEarn } = getReferralHandlers();
                    await handleInviteEarn(msg);
                    break;
                    
                case '🏆 Leaderboard':
                    const { handleLeaderboard } = getReferralHandlers();
                    await handleLeaderboard(msg);
                    break;
                    
                case '👤 My Profile':
                    const { handleMyProfile } = getProfileHandlers();
                    await handleMyProfile(msg);
                    break;
                    
                case '📌 Rules':
                    const { handleRules } = getHelpHandlers();
                    await handleRules(msg);
                    break;
                    
                case '❓ Help':
                    const { handleHelp } = getHelpHandlers();
                    await handleHelp(msg);
                    break;
                    
                case '📚 Free Trial':
                    const { handleTrialMaterials } = getTrialHandlers();
                    await handleTrialMaterials(msg);
                    break;
                    
                default:
                    // Handle registration flow and other states
                    const { handleNavigation } = getRegistrationHandlers();
                    if (await handleNavigation(msg)) return;
                    
                    const { handleProfileText } = getProfileHandlers();
                    if (await handleProfileText(msg)) return;
                    
                    // Handle name input for registration
                    const { handleNameInput } = getRegistrationHandlers();
                    await handleNameInput(msg);
            }
        }
    } catch (error) {
        console.error('❌ Error in handleMessage:', error);
        await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
};

// Callback query handler
const handleCallbackQuery = async (callbackQuery) => {
    const data = callbackQuery.data;
    
    console.log(`🔄 Callback: ${data}`);
    
    try {
        // Route to appropriate handler
        if (data.startsWith('admin_')) {
            const { handleAdminApprovePayment } = getAdminHandlers();
            if (data.startsWith('admin_approve_payment_')) {
                await handleAdminApprovePayment(callbackQuery);
            }
        } else if (data.startsWith('stream_') || data.startsWith('payment_')) {
            const { handleRegistrationCallback } = getRegistrationHandlers();
            await handleRegistrationCallback(callbackQuery);
        } else if (data.startsWith('profile_') || data.startsWith('payment_update_')) {
            const { handleProfileCallback } = getProfileHandlers();
            await handleProfileCallback(callbackQuery);
        } else if (data === 'leaderboard') {
            const { handleLeaderboard } = getReferralHandlers();
            await handleLeaderboard(callbackQuery.message);
        } else if (data === 'my_referrals') {
            const { handleMyReferrals } = getReferralHandlers();
            await handleMyReferrals(callbackQuery.message);
        } else if (data.startsWith('trial_view_')) {
            const { handleViewTrialMaterial } = getTrialHandlers();
            await handleViewTrialMaterial(callbackQuery);
        }
        
        // Answer all callback queries
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        console.error('❌ Error in handleCallbackQuery:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing request' });
    }
};

module.exports = {
    handleMessage,
    handleCallbackQuery
};
