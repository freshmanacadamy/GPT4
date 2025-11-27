const env = require('../config/environment');

class MessageHelper {
    // Utility to replace {placeholders} in messages
    static replacePlaceholders(text, variables = {}) {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return result;
    }

    // Fetches button text from the environment config
    static getButtonText(buttonKey) {
        return env.BUTTON_TEXTS[buttonKey] || buttonKey;
    }

    // Fetches and processes message text from the environment config
    static getMessage(messageKey, variables = {}) {
        // Use property access for dynamic config keys
        const message = env.MESSAGES?.[messageKey] || env[`${messageKey}_MESSAGE`];
        
        // Use a fallback if the key is not in MESSAGES or as a direct constant
        const finalMessage = message || messageKey; 
        
        // Ensure placeholders are replaced
        return this.replacePlaceholders(finalMessage, variables);
    }

    // Constructs the main menu keyboard
    static getMainMenuButtons(isVerified = false) {
        const { checkFeatureStatus } = require('./helpers');
        const registrationStatus = checkFeatureStatus('registration');
        const referralStatus = checkFeatureStatus('referral');
        const trialStatus = checkFeatureStatus('trial'); // NEW
        
        const keyboard = [];
        
        if (!isVerified && registrationStatus.allowed) {
            keyboard.push([this.getButtonText('REGISTER')]);
        }

        if (isVerified) {
            // Verified users get access to paid content and referral tools
            if (referralStatus.allowed) {
                keyboard.push([
                    this.getButtonText('INVITE'), 
                    this.getButtonText('LEADERBOARD')
                ]);
            }
        } else {
            // Unverified users see the payment button
            keyboard.push([this.getButtonText('PAY_FEE')]);
        }
        
        // Common buttons
        const commonRow = [];
        if (trialStatus.allowed) {
            commonRow.push(this.getButtonText('TRIAL_MATERIALS')); // NEW BUTTON
        }
        commonRow.push(this.getButtonText('PROFILE'));
        keyboard.push(commonRow);

        keyboard.push([
            this.getButtonText('RULES'), 
            this.getButtonText('HELP')
        ]);

        return keyboard;
    }
    
    // ... (other specialized keyboard builders like getRegistrationButtons, getAdminButtons)
}

module.exports = MessageHelper;
