// Add at the top of api.js
const { initializeConfig, ADMIN_IDS } = require('./config/environment');

// Initialize configuration on startup
initializeConfig().then(() => {
    console.log('✅ Bot configuration initialized');
}).catch(error => {
    console.error('❌ Failed to initialize config:', error);
});

// Global error handlers
process.on('unhandledRejection', (error) => { console.error('🔴 Unhandled Promise Rejection:', error); });
process.on('uncaughtException', (error) => { console.error('🔴 Uncaught Exception:', error); });

// Import configurations and handlers
const bot = require('./config/bot');
const { showMainMenu } = require('./handlers/menu');
const { getUser } = require('./database/users'); 
const { 
    handleContactShared, 
    handlePaymentScreenshot, 
    handleNavigation, 
    handleRegistrationCallback, 
    handleNameInput,
    handleRegisterTutorial
} = require('./handlers/registration');
const { handlePayFee } = require('./handlers/payment');
const { handleReferralStart } = require('./handlers/referral');
const { handleMyProfile } = require('./handlers/profile');
const { handleAdminPanel, handleAdminApprovePayment, handleAdminRejectPayment, handleDailyStatsCommand } = require('./handlers/admin'); 
const StudentManagement = require('./handlers/studentManagement');
const SettingsHandler = require('./handlers/settings'); 
const { handleTrialMaterials, handleViewTrialMaterial } = require('./handlers/trial'); // NEW IMPORTS
const MessageHelper = require('./utils/messageHelper');

// --- Main Message Handler ---
const handleMessage = async (message) => {
    const userId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text;
    const user = await getUser(userId);
    const isAdmin = ADMIN_IDS.includes(userId);

    // 🛡️ CRITICAL FEATURE CHECK: Blocked User
    if (user?.blocked) { return; }
    
    // 1. Handle Stateful Flows (Registration & Settings)
    if (user?.registrationStep === 'awaiting_name' && !text.startsWith('/')) {
        await handleNameInput(message);
        return;
    }
    if (user?.registrationStep === 'awaiting_screenshot' && (message.photo || message.document)) {
        await handlePaymentScreenshot(message);
        return;
    }
    if (isAdmin && SettingsHandler.getEditingState(userId)) {
        await SettingsHandler.handleSetInput(message);
        return;
    }

    // 2. Handle Commands and Button Clicks
    if (text?.startsWith('/start')) {
        await handleReferralStart(message);
        await showMainMenu(chatId);
    } else if (message.contact) {
        await handleContactShared(message);
    } else if (text === MessageHelper.getButtonText('TRIAL_MATERIALS')) { // NEW BUTTON ROUTE
        await handleTrialMaterials(message);
    } else if (text === MessageHelper.getButtonText('REGISTER')) {
        await handleRegisterTutorial(message);
    } else if (text === MessageHelper.getButtonText('PAY_FEE')) {
        await handlePayFee(message);
    } else if (text === MessageHelper.getButtonText('PROFILE')) {
        await handleMyProfile(message);
    } 
    // Admin Commands/Buttons
    else if (text === '/admin' && isAdmin) {
        await handleAdminPanel(message);
    } else if (text === '/dailystats' && isAdmin) { 
        await handleDailyStatsCommand(message);
    } else if (text?.startsWith('/set ') && isAdmin) { // Used for dynamic text editing
        await SettingsHandler.handleSetCommand(message);
    } else if (isAdmin && text === MessageHelper.getButtonText('MANAGE_STUDENTS')) {
        await StudentManagement.showStudentManagement(message);
    } else if (isAdmin && text === MessageHelper.getButtonText('BOT_SETTINGS')) {
        await SettingsHandler.showSettingsDashboard(message);
    }
    
    // 3. Generic navigation handlers
    else if (await handleNavigation(message)) {
        // Handled navigation (e.g., 'Homepage' or 'Cancel Reg')
    } else {
        await bot.sendMessage(chatId, "🤔 I'm not sure what you mean. Please use the buttons or type /start.", { parse_mode: 'Markdown' });
    }
};

// --- Main Callback Query Handler ---
const handleCallbackQuery = async (callbackQuery) => {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const isAdmin = ADMIN_IDS.includes(userId);

    if (data.startsWith('stream_') || data.startsWith('payment_')) {
        await handleRegistrationCallback(callbackQuery);
    } else if (data.startsWith('admin_') && isAdmin) {
        if (data.startsWith('admin_approve_payment_')) {
            await handleAdminApprovePayment(callbackQuery);
        } else if (data.startsWith('admin_reject_payment_')) {
            await handleAdminRejectPayment(callbackQuery);
        }
    } else if (data.startsWith('students_') && isAdmin) { // NEW STUDENT MANAGEMENT CALLBACKS
        if (data.startsWith('students_view_details_')) {
            await StudentManagement.handleAdminUserDetails(callbackQuery);
        } else if (data.startsWith('students_delete_')) {
            await StudentManagement.handleDeleteUser(callbackQuery);
        }
    } else if (data.startsWith('trial_')) { // NEW TRIAL MATERIALS CALLBACKS
        await handleViewTrialMaterial(callbackQuery);
    }
    
    // Always answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id);
};


// ---------------------------------------------------------------------
// Vercel Entry Point
// ---------------------------------------------------------------------
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            const update = req.body;
            if (update.message) {
                await handleMessage(update.message);
            } else if (update.callback_query) {
                await handleCallbackQuery(update.callback_query);
            }
            return res.status(200).json({ ok: true });
        } catch (error) {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    return res.status(405).json({ error: 'Method not allowed' });
};
