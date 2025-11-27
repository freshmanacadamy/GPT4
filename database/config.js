const db = require('../config/firebase');

const CONFIG_COLLECTION = 'bot_config';

// Default configuration values for initialization (should match keys in environment.js)
const DEFAULT_CONFIG = {
    'registration_fee': 500,
    'referral_reward': 30,
    'min_referrals_withdraw': 4,
    'min_withdrawal_amount': 120,
    
    'maintenance_mode': false,
    'registration_enabled': true,
    'referral_enabled': true,
    'withdrawal_enabled': true,
    'tutorial_enabled': true,
    'trial_enabled': true, // NEW
    
    'maintenance_message': '🚧 Bot is under maintenance. Please check back later.',
    'registration_disabled_message': '❌ Registration is temporarily closed.',
    'referral_disabled_message': '❌ Referral program is currently paused.',
    'withdrawal_disabled_message': '❌ Withdrawals are temporarily suspended.',
    'tutorials_disabled_message': '❌ Tutorial access is currently unavailable.',
    
    'welcome_message': '🎯 *COMPLETE TUTORIAL REGISTRATION BOT*\\n\\n📚 Register for comprehensive tutorials\\n💰 Registration fee: {fee} ETB\\n🎁 Earn {reward} ETB per referral\\n\\nChoose an option below:',
    'start_message': '🎯 *Welcome to Tutorial Registration Bot!*\\n\\n📚 Register for our comprehensive tutorials\\n💰 Registration fee: {fee} ETB\\n🎁 Earn {reward} ETB per referral\\n\\nStart your registration journey!',
    
    'reg_start': '👤 *ENTER YOUR FULL NAME*\\n\\nPlease type your full name:',
    'reg_name_saved': '✅ Name saved: *{name}*\\n\\n📱 *SHARE YOUR PHONE NUMBER*\\n\\nPlease share your phone number using the button below:',
    'reg_phone_saved': '✅ Phone saved: *{phone}*\\n\\n🎓 *SELECT YOUR STREAM*\\n\\nChoose your field of study:',
    'reg_success': '🎉 *REGISTRATION SUCCESSFUL!*\\n\\n✅ Your registration is complete\\n✅ Payment verification pending\\n⏳ Please wait for admin approval\\n\\n_You will be notified once approved._',

    // Button keys (example, the actual buttons are in environment.js)
    'button_register': '📝 Register',
    // ... all other button keys
};

class ConfigService {
    static async get(key) {
        try {
            const doc = await db.collection(CONFIG_COLLECTION).doc(key).get();
            return doc.exists ? doc.data().value : DEFAULT_CONFIG[key];
        } catch (error) {
            return DEFAULT_CONFIG[key];
        }
    }

    static async set(key, value) {
        try {
            // Convert boolean strings back to booleans if applicable
            if (['true', 'false'].includes(String(value).toLowerCase())) {
                value = (String(value).toLowerCase() === 'true');
            }
            await db.collection(CONFIG_COLLECTION).doc(key).set({ value: value });
            return true;
        } catch (error) {
            return false;
        }
    }

    static async getAll() {
        try {
            const snapshot = await db.collection(CONFIG_COLLECTION).get();
            const config = { ...DEFAULT_CONFIG };
            
            snapshot.forEach(doc => {
                config[doc.id] = doc.data().value;
            });
            
            return config;
        } catch (error) {
            return DEFAULT_CONFIG;
        }
    }
}

module.exports = ConfigService;
