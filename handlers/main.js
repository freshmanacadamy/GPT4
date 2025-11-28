// handlers/main.js - COMPLETE FIXED VERSION
const bot = require('../config/bot');

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
    
    console.log(`💬 Message from ${userId}: "${text}"`);
    
    try {
        // Handle photo messages (payment screenshots)
        if (msg.photo) {
            console.log('📸 Photo received for payment');
            await handlePaymentScreenshot(msg);
            return;
        }
        
        // Handle contact sharing
        if (msg.contact) {
            console.log('📱 Contact shared');
            await handleContactShared(msg);
            return;
        }

        // Handle commands and text messages
        if (text.startsWith('/')) {
            console.log(`🔍 Processing command: ${text}`);
            switch (text) {
                case '/start':
                    console.log('🚀 Starting bot with referral check');
                    await handleReferralStart(msg);
                    await showMainMenu(chatId);
                    break;
                    
                case '/help':
                case '❓ Help':
                    console.log('❓ Help requested');
                    await handleHelp(msg);
                    break;
                    
                case '/admin':
                    console.log('👑 Admin panel requested');
                    await handleAdminPanel(msg);
                    break;
                    
                case '/dailystats':
                    console.log('📊 Daily stats requested');
                    await handleDailyStatsCommand(msg);
                    break;
                    
                case '/menu':
                    console.log('🏠 Menu requested');
                    await showMainMenu(chatId);
                    break;
                    
                default:
                    console.log('❓ Unknown command, showing menu');
                    await showMainMenu(chatId);
            }
            return; // ✅ CRITICAL FIX: Prevent falling through to button handling
        } else {
            // Handle button clicks and regular messages
            console.log(`🔍 Processing button/text: "${text}"`);
            
            switch (text) {
                case '📝 Register':
                    console.log('📝 Register button clicked');
                    await handleRegisterTutorial(msg);
                    break;
                    
                case '💰 Pay Fee':
                    console.log('💰 Pay Fee button clicked');
                    await handlePayFee(msg);
                    break;
                    
                case '🎁 Invite & Earn':
                    console.log('🎁 Invite button clicked');
                    await handleInviteEarn(msg);
                    break;
                    
                case '🏆 Leaderboard':
                    console.log('🏆 Leaderboard button clicked');
                    await handleLeaderboard(msg);
                    break;
                    
                case '👤 My Profile':
                    console.log('👤 Profile button clicked');
                    await handleMyProfile(msg);
                    break;
                    
                case '📌 Rules':
                    console.log('📌 Rules button clicked');
                    await handleRules(msg);
                    break;
                    
                case '❓ Help':
                    console.log('❓ Help button clicked');
                    await handleHelp(msg);
                    break;
                    
                case '📚 Free Trial':
                    console.log('📚 Trial button clicked');
                    await handleTrialMaterials(msg);
                    break;
                    
                default:
                    console.log('🔍 Processing as registration/text input');
                    // Handle registration flow and other states
                    if (await handleNavigation(msg)) {
                        console.log('✅ Handled by navigation');
                        return;
                    }
                    if (await handleProfileText(msg)) {
                        console.log('✅ Handled by profile text');
                        return;
                    }
                    
                    // Handle name input for registration
                    console.log('📝 Processing as name input');
                    await handleNameInput(msg);
            }
        }
        
    } catch (error) {
        console.error('❌ Error in handleMessage:', error);
        console.error('Error stack:', error.stack);
        
        try {
            await bot.sendMessage(chatId, 
                '❌ An error occurred. Please try again.\\n\\nIf the problem persists, contact support.',
                { parse_mode: 'Markdown' }
            );
        } catch (sendError) {
            console.error('❌ Failed to send error message:', sendError);
        }
    }
};

// Callback query handler
const handleCallbackQuery = async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    console.log(`🔄 Callback received: ${data} from ${chatId}`);
    
    try {
        // Route to appropriate handler
        if (data.startsWith('admin_')) {
            console.log('👑 Admin callback detected');
            if (data.startsWith('admin_approve_payment_')) {
                console.log('✅ Admin payment approval');
                await handleAdminApprovePayment(callbackQuery);
            } else if (data.startsWith('admin_reject_payment_')) {
                console.log('❌ Admin payment rejection');
                // await handleAdminRejectPayment(callbackQuery);
            }
        } else if (data.startsWith('stream_') || data.startsWith('payment_')) {
            console.log('📝 Registration callback');
            await handleRegistrationCallback(callbackQuery);
        } else if (data.startsWith('profile_') || data.startsWith('payment_update_')) {
            console.log('👤 Profile callback');
            await handleProfileCallback(callbackQuery);
        } else if (data === 'leaderboard') {
            console.log('🏆 Leaderboard callback');
            await handleLeaderboard(callbackQuery.message);
        } else if (data === 'my_referrals') {
            console.log('👥 My referrals callback');
            await handleMyReferrals(callbackQuery.message);
        } else if (data.startsWith('trial_view_')) {
            console.log('📚 Trial material callback');
            await handleViewTrialMaterial(callbackQuery);
        } else {
            console.log('❓ Unknown callback type');
        }
        
        // Answer all callback queries
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processed' });
        console.log('✅ Callback answered');
        
    } catch (error) {
        console.error('❌ Error in handleCallbackQuery:', error);
        console.error('Error stack:', error.stack);
        
        try {
            await bot.answerCallbackQuery(callbackQuery.id, { 
                text: '❌ Error processing request' 
            });
        } catch (answerError) {
            console.error('❌ Failed to answer callback:', answerError);
        }
    }
};

module.exports = {
    handleMessage,
    handleCallbackQuery
};
