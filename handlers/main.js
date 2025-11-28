// handlers/main.js - COMPLETE ROUTER FILE

// CORE IMPORTS
const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const { BUTTON_TEXTS, ADMIN_IDS } = require('../config/environment');
const { showMainMenu } = require('./menu');
const MessageHelper = require('../utils/messageHelper');

// IMPORT ALL HANDLERS
// Registration & Payments
const {
    handleRegisterTutorial,
    handleNameInput,
    handleContactShared,
    handleNavigation,
    handleRegistrationCallback
} = require('./registration');

const { handlePayFee, handlePaymentScreenshot } = require('./payment');

// Referral System
const { 
    handleInviteEarn, 
    handleLeaderboard, 
    handleMyReferrals, 
    handleReferralStart, 
    handleReferralCallback 
} = require('./referral');

// Profile System
const { 
    handleMyProfile, 
    handleProfileCallback, 
    handleProfileText 
} = require('./profile');

// Admin System
const { 
    handleAdminPanel, 
    handleDailyStatsCommand, 
    handleAdminCallback,
    handleStudentManagement
} = require('./admin');

// Settings System
const SettingsHandler = require('./settings');

// Trial System
const { 
    handleTrialMaterials, 
    handleTrialCallback, 
    handleAdminTrialText 
} = require('./trial');

// Messaging System
const MessagingHandler = require('./messaging');

// Export System
const ExportHandler = require('./export');

// Help System
const { handleHelp, handleRules } = require('./help');

// =========================================================================
// 1. MESSAGE HANDLER (TEXT, COMMANDS, CONTACT, PHOTO)
// =========================================================================

const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    const user = await UserService.getUser(userId);
    let referrerId = null;

    try {
        // 1.1. Handle /start command (including referral links)
        if (text?.startsWith('/start')) {
            referrerId = await handleReferralStart(msg);
            
            // Check if user is blocked
            if (user?.blocked) {
                await bot.sendMessage(chatId, '❌ You are blocked from using this bot.', { parse_mode: 'Markdown' });
                return;
            }

            // Initialize user if new
            if (!user || text === '/start') {
                const userData = {
                    telegramId: userId,
                    firstName: msg.from.first_name,
                    username: msg.from.username || null,
                    isVerified: false,
                    registrationStep: 'not_started',
                    paymentStatus: 'not_started',
                    referralCount: user?.referralCount || 0,
                    rewards: user?.rewards || 0,
                    joinedAt: user?.joinedAt || new Date()
                };
                if (referrerId) {
                    userData.referrerId = referrerId.toString();
                }
                await UserService.setUser(userId, userData);
            }
            await showMainMenu(chatId);
            return;
        }

        // 1.2. Handle Admin Commands
        if (ADMIN_IDS.includes(userId)) {
            // Admin Panel
            if (text === '/admin' || text === BUTTON_TEXTS.ADMIN_PANEL) {
                await handleAdminPanel(msg);
                return;
            }
            
            // Daily Stats
            if (text === '/dailystats' || text === BUTTON_TEXTS.STUDENT_STATS) {
                await handleDailyStatsCommand(msg);
                return;
            }
            
            // Settings Command
            if (text.startsWith('/set ')) {
                await SettingsHandler.handleSetCommand(msg);
                return;
            }
            
            // Student Management
            if (text === BUTTON_TEXTS.MANAGE_STUDENTS) {
                await handleStudentManagement(msg);
                return;
            }
            
            // Broadcast
            if (text === BUTTON_TEXTS.BROADCAST) {
                await MessagingHandler.handleBroadcast(msg);
                return;
            }
            
            // Export Data
            if (text === BUTTON_TEXTS.EXPORT_DATA) {
                await ExportHandler.handleExportData(msg);
                return;
            }
            
            // Bot Settings
            if (text === BUTTON_TEXTS.BOT_SETTINGS) {
                await SettingsHandler.showSettingsDashboard(msg);
                return;
            }
        }
        
        // 1.3. Handle General Text Messages (Menu Buttons)
        if (text) {
            // Check for navigation (Cancel Reg/Homepage)
            if (await handleNavigation(msg)) {
                return;
            }

            // Handle messaging system text input
            if (await MessagingHandler.handleMessagingText(msg)) {
                return;
            }

            // Handle admin trial text input
            if (await handleAdminTrialText(msg)) {
                return;
            }

            // Handle settings text input
            const settingsState = SettingsHandler.getEditingState(userId);
            if (settingsState) {
                await SettingsHandler.handleSetInput(msg);
                return;
            }

            // Handle profile text input (withdrawal states)
            if (await handleProfileText(msg)) {
                return;
            }

            // Handle main menu buttons
            switch (text) {
                case BUTTON_TEXTS.REGISTER:
                    await handleRegisterTutorial(msg);
                    return;
                    
                case BUTTON_TEXTS.PAY_FEE:
                    await handlePayFee(msg);
                    return;
                    
                case BUTTON_TEXTS.INVITE:
                    await handleInviteEarn(msg);
                    return;
                    
                case BUTTON_TEXTS.LEADERBOARD:
                    await handleLeaderboard(msg);
                    return;
                    
                case BUTTON_TEXTS.PROFILE:
                    await handleMyProfile(msg);
                    return;
                    
                case BUTTON_TEXTS.HELP:
                    await handleHelp(msg);
                    return;
                    
                case BUTTON_TEXTS.RULES:
                    await handleRules(msg);
                    return;
                    
                case BUTTON_TEXTS.TRIAL_MATERIALS:
                    await handleTrialMaterials(msg);
                    return;
                    
                case BUTTON_TEXTS.HOMEPAGE:
                    await showMainMenu(chatId);
                    return;
            }
        }
        
        // 1.4. Handle Shared Contact
        if (msg.contact) {
            if (user?.registrationStep === 'awaiting_phone') {
                await handleContactShared(msg);
                return;
            }
        }

        // 1.5. Handle Photo/Document (Payment Screenshot)
        if (msg.photo || msg.document) {
            // Payment screenshot
            if (user?.registrationStep === 'awaiting_screenshot') {
                await handlePaymentScreenshot(msg);
                return;
            }
        }

        // 1.6. Handle User State-Based Text Input
        if (user) {
            switch (user.registrationStep) {
                case 'awaiting_name':
                    await handleNameInput(msg);
                    return;
            }
        }

        // 1.7. Default Fallback - Only if no other handlers processed the message
        if (text && !text.startsWith('/')) {
            await bot.sendMessage(chatId, 
                "❌ Command not recognized.\n\nPlease use the menu buttons or type /help for assistance.", 
                { parse_mode: 'Markdown' }
            );
        }

    } catch (error) {
        console.error('❌ Main message handler error:', error);
        await bot.sendMessage(chatId, 
            "❌ An error occurred. Please try again or contact support.", 
            { parse_mode: 'Markdown' }
        );
    }
};

// =========================================================================
// 2. CALLBACK QUERY HANDLER (INLINE BUTTONS)
// =========================================================================

const handleCallbackQuery = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    try {
        // Always answer callback query first
        await bot.answerCallbackQuery(callbackQuery.id);

        // 2.1. Admin Callbacks (Check permission first)
        if (ADMIN_IDS.includes(userId)) {
            // Admin management callbacks
            if (await handleAdminCallback(callbackQuery)) {
                return;
            }
            
            // Messaging system callbacks
            if (await MessagingHandler.handleMessagingCallback(callbackQuery)) {
                return;
            }
            
            // Export system callbacks
            if (await ExportHandler.handleExportCallback(callbackQuery)) {
                return;
            }
        }

        // 2.2. Profile Callbacks (Withdrawal, Payment info)
        if (await handleProfileCallback(callbackQuery)) {
            return;
        }

        // 2.3. Referral Callbacks (My Referrals, Leaderboard)
        if (await handleReferralCallback(callbackQuery)) {
            return;
        }

        // 2.4. Registration Callbacks (Stream selection, Payment method)
        if (await handleRegistrationCallback(callbackQuery)) {
            return;
        }

        // 2.5. Trial System Callbacks (Folders, Materials, Admin)
        if (await handleTrialCallback(callbackQuery)) {
            return;
        }

        // 2.6. Navigation Callbacks
        if (data === 'back_to_main') {
            await showMainMenu(chatId);
            return;
        }

        // 2.7. Unknown Callback
        console.log(`❌ Unhandled callback query: ${data} from user ${userId}`);
        await bot.answerCallbackQuery(callbackQuery.id, { 
            text: '❌ This action is not available or expired.' 
        });

    } catch (error) {
        console.error('❌ Callback query handler error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { 
            text: '❌ Error processing your request.' 
        });
    }
};

// =========================================================================
// 3. ERROR HANDLER (Global error catcher)
// =========================================================================

const handleError = async (error, context = 'unknown') => {
    console.error(`❌ Error in ${context}:`, error);
    
    // Notify master admins of critical errors
    const { MASTER_ADMIN_IDS } = require('../config/environment');
    const errorMessage = `🔴 *BOT ERROR*\n\nContext: ${context}\nError: ${error.message}\nTime: ${new Date().toISOString()}`;
    
    for (const adminId of MASTER_ADMIN_IDS) {
        try {
            await bot.sendMessage(adminId, errorMessage, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error('Failed to notify admin:', e);
        }
    }
};

// =========================================================================
// 4. EXPORT HANDLERS FOR api.js
// =========================================================================

module.exports = {
    handleMessage,
    handleCallbackQuery,
    handleError
};
