require('dotenv').config();

// Environment variables with defaults
const environment = {
    // Bot Configuration
    BOT_TOKEN: process.env.BOT_TOKEN,
    BOT_USERNAME: process.env.BOT_USERNAME || 'your_bot_username',
    
    // Admin Configuration
    ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
    MASTER_ADMIN_IDS: process.env.MASTER_ADMIN_IDS ? process.env.MASTER_ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
    
    // Firebase Configuration
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID,
    FIREBASE_CLIENT_X509_CERT_URL: process.env.FIREBASE_CLIENT_X509_CERT_URL,

    // Default configuration (will be overridden by database)
    DEFAULT_CONFIG: {
        registration_fee: 500,
        referral_reward: 30,
        min_referrals_withdraw: 4,
        min_withdrawal_amount: 120,
        maintenance_mode: false,
        registration_enabled: true,
        referral_enabled: true,
        withdrawal_enabled: true,
        tutorial_enabled: true,
        trial_enabled: true
    }
};

// Live configuration (will be populated from database)
let liveConfig = { ...environment.DEFAULT_CONFIG };

// Configuration service (will be properly initialized in database module)
const ConfigService = {
    async initialize() {
        try {
            // This will be properly implemented in database module
            console.log('✅ Configuration system ready');
        } catch (error) {
            console.error('❌ Config initialization failed:', error);
        }
    },

    async refresh() {
        // Will be implemented in database module
    },

    get(key) {
        return liveConfig[key] !== undefined ? liveConfig[key] : environment.DEFAULT_CONFIG[key];
    },

    async set(key, value) {
        // Will be implemented in database module
        liveConfig[key] = value;
        return true;
    }
};

module.exports = {
    ...environment,
    ConfigService,
    get REGISTRATION_FEE() { return parseInt(ConfigService.get('registration_fee')); },
    get REFERRAL_REWARD() { return parseInt(ConfigService.get('referral_reward')); },
    get MIN_REFERRALS_FOR_WITHDRAW() { return parseInt(ConfigService.get('min_referrals_withdraw')); },
    get MIN_WITHDRAWAL_AMOUNT() { return parseInt(ConfigService.get('min_withdrawal_amount')); },
    get MAINTENANCE_MODE() { return ConfigService.get('maintenance_mode') === true || ConfigService.get('maintenance_mode') === 'true'; },
    get REGISTRATION_SYSTEM_ENABLED() { return ConfigService.get('registration_enabled') === true || ConfigService.get('registration_enabled') === 'true'; },
    get INVITE_SYSTEM_ENABLED() { return ConfigService.get('referral_enabled') === true || ConfigService.get('referral_enabled') === 'true'; },
    get WITHDRAWAL_SYSTEM_ENABLED() { return ConfigService.get('withdrawal_enabled') === true || ConfigService.get('withdrawal_enabled') === 'true'; },
    get TUTORIAL_SYSTEM_ENABLED() { return ConfigService.get('tutorial_enabled') === true || ConfigService.get('tutorial_enabled') === 'true'; },
    get TRIAL_SYSTEM_ENABLED() { return ConfigService.get('trial_enabled') === true || ConfigService.get('trial_enabled') === 'true'; }
};
