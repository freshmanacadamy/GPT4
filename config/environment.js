require('dotenv').config();
const ConfigService = require('../database/config');

let liveConfig = {};

const initializeConfig = async () => {
    try {
        liveConfig = await ConfigService.getAll();
    } catch (error) {
        liveConfig = {};
    }
};

const getConfig = (key) => {
    return liveConfig[key] !== undefined ? liveConfig[key] : (process.env[key.toUpperCase()] || null);
};

const getBoolConfig = (key) => {
    const value = getConfig(key);
    return value === true || value === 'true' || value === '1';
};

const getNumericConfig = (key, defaultValue = 0) => {
    const value = getConfig(key);
    const num = parseInt(value);
    return isNaN(num) ? defaultValue : num;
};

// Helper to allow admin settings to refresh the live config cache
const refreshConfig = async () => {
    liveConfig = await ConfigService.getAll();
};

module.exports = {
    // Live configuration getters
    get REGISTRATION_FEE() { return getNumericConfig('registration_fee', 500); },
    get REFERRAL_REWARD() { return getNumericConfig('referral_reward', 30); },
    get MIN_REFERRALS_FOR_WITHDRAW() { return getNumericConfig('min_referrals_withdraw', 4); },
    get MIN_WITHDRAWAL_AMOUNT() { return getNumericConfig('min_withdrawal_amount', 120); },
    
    // Feature Toggles (Booleans)
    get MAINTENANCE_MODE() { return getBoolConfig('maintenance_mode'); },
    get REGISTRATION_SYSTEM_ENABLED() { return getBoolConfig('registration_enabled'); },
    get INVITE_SYSTEM_ENABLED() { return getBoolConfig('referral_enabled'); },
    get WITHDRAWAL_SYSTEM_ENABLED() { return getBoolConfig('withdrawal_enabled'); },
    get TUTORIAL_SYSTEM_ENABLED() { return getBoolConfig('tutorial_enabled'); },
    get TRIAL_SYSTEM_ENABLED() { return getBoolConfig('trial_enabled'); }, // NEW
    
    // Messages (Strings)
    get MAINTENANCE_MESSAGE() { return getConfig('maintenance_message'); },
    get REGISTRATION_DISABLED_MESSAGE() { return getConfig('registration_disabled_message'); },
    get INVITE_DISABLED_MESSAGE() { return getConfig('referral_disabled_message'); },
    get WITHDRAWAL_DISABLED_MESSAGE() { return getConfig('withdrawal_disabled_message'); },
    get TUTORIALS_DISABLED_MESSAGE() { return getConfig('tutorials_disabled_message'); },
    
    // Welcome/Start Messages
    get WELCOME_MESSAGE() { return getConfig('welcome_message'); },
    get START_MESSAGE() { return getConfig('start_message'); },
    
    // Registration Prompts
    get REG_START() { return getConfig('reg_start'); },
    get REG_NAME_SAVED() { return getConfig('reg_name_saved'); },
    get REG_PHONE_SAVED() { return getConfig('reg_phone_saved'); },
    get REG_SUCCESS() { return getConfig('reg_success'); },

    // Button Labels
    get BUTTON_TEXTS() { 
        return {
            REGISTER: getConfig('button_register') || '📝 Register',
            PAY_FEE: getConfig('button_pay_fee') || '💰 Pay Fee',
            INVITE: getConfig('button_invite') || '🎁 Invite & Earn',
            LEADERBOARD: getConfig('button_leaderboard') || '🏆 Leaderboard',
            HELP: getConfig('button_help') || '❓ Help',
            RULES: getConfig('button_rules') || '📌 Rules',
            PROFILE: getConfig('button_profile') || '👤 My Profile',
            SHARE_PHONE: getConfig('button_share_phone') || '📱 Share Phone',
            CANCEL_REG: getConfig('button_cancel_reg') || '❌ Cancel Registration',
            HOMEPAGE: getConfig('button_homepage') || '🏠 Homepage',
            MANAGE_STUDENTS: getConfig('button_manage_students') || '👥 Manage Students',
            REVIEW_PAYMENTS: getConfig('button_review_payments') || '💰 Review Payments',
            BOT_SETTINGS: getConfig('button_bot_settings') || '⚙️ Bot Settings',
            MESSAGE_SETTINGS: getConfig('button_message_settings') || '💬 Message Settings',
            FEATURE_TOGGLE: getConfig('button_feature_toggle') || '⚡ Feature Toggle',
            STUDENT_STATS: getConfig('button_student_stats') || '📊 Student Stats',
            BROADCAST: getConfig('button_broadcast') || '📢 Broadcast',
            TRIAL_MATERIALS: getConfig('button_trial_materials') || '📚 Free Trial', // NEW
        };
    },

    // Original environment variables (for backward compatibility)
    BOT_TOKEN: process.env.BOT_TOKEN,
    CHANNEL_ID: process.env.CHANNEL_ID,
    ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
    BOT_USERNAME: process.env.BOT_USERNAME || 'your_bot_username',
    
    // Export service for use in handlers
    ConfigService,
    initializeConfig,
    refreshConfig
};
