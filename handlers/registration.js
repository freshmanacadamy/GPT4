const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const { showMainMenu } = require('./menu');
const MessageHelper = require('../utils/messageHelper');
const { validateName, checkFeatureStatus } = require('../utils/helpers');

// User state tracking
const userStates = new Map();

const RegistrationHandler = {
    // Start registration process
    async handleRegisterTutorial(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            // Check feature status
            const feature = checkFeatureStatus('registration');
            if (!feature.allowed) {
                await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
                return;
            }

            // Check if already verified
            const user = await UserService.getUser(userId);
            if (user?.isVerified) {
                await bot.sendMessage(chatId, "✅ *You are already registered and verified!*", { parse_mode: 'Markdown' });
                return;
            }

            // Initialize registration state
            userStates.set(userId, {
                state: 'awaiting_name',
                data: {
                    telegramId: userId,
                    firstName: msg.from.first_name,
                    username: msg.from.username || '',
                    isVerified: false,
                    registrationStep: 'awaiting_name',
                    paymentStatus: 'not_started'
                }
            });

            await bot.sendMessage(chatId, MessageHelper.getMessage('REG_START'), {
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('❌ Registration start error:', error);
            await bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
        }
    },

    // Handle name input
    async handleNameInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const name = msg.text?.trim();

        try {
            const userState = userStates.get(userId);
            if (!userState || userState.state !== 'awaiting_name') return;

            if (!validateName(name)) {
                await bot.sendMessage(chatId, "❌ *Invalid Name.* Please enter your full name (2-50 characters).", { parse_mode: 'Markdown' });
                return;
            }

            // Update state
            userState.state = 'awaiting_phone';
            userState.data.name = name;
            userState.data.registrationStep = 'awaiting_phone';
            userStates.set(userId, userState);

            // Save to database
            await UserService.setUser(userId, userState.data);

            // Request phone number
            const options = {
                reply_markup: {
                    keyboard: MessageHelper.getRegistrationButtons(),
                    resize_keyboard: true,
                    one_time_keyboard: true
                },
                parse_mode: 'Markdown'
            };

            await bot.sendMessage(chatId, 
                MessageHelper.getMessage('REG_NAME_SAVED', { name: name }), 
                options
            );

        } catch (error) {
            console.error('❌ Name input error:', error);
            await bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
        }
    },

    // Handle contact sharing
    async handleContactShared(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const contact = msg.contact;

        try {
            const userState = userStates.get(userId);
            if (!userState || userState.state !== 'awaiting_phone') return;

            // Verify it's the user's own contact
            if (contact.user_id !== userId) {
                await bot.sendMessage(chatId, "❌ *Please share your OWN phone number* using the button.", { parse_mode: 'Markdown' });
                return;
            }

            // Update state
            userState.state = 'awaiting_stream';
            userState.data.phone = contact.phone_number;
            userState.data.registrationStep = 'awaiting_stream';
            userStates.set(userId, userState);

            // Save to database
            await UserService.setUser(userId, userState.data);

            // Request stream selection
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🧮 Natural Science', callback_data: 'stream_natural' }],
                        [{ text: '💼 Social Science', callback_data: 'stream_social' }],
                        [{ text: '💻 Technology', callback_data: 'stream_technology' }]
                    ]
                },
                parse_mode: 'Markdown'
            };

            await bot.sendMessage(chatId, 
                MessageHelper.getMessage('REG_PHONE_SAVED', { phone: contact.phone_number }), 
                options
            );

        } catch (error) {
            console.error('❌ Contact sharing error:', error);
            await bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
        }
    },

    // Handle stream selection
    async handleStreamSelection(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const stream = callbackQuery.data.split('_')[1];

        try {
            const userState = userStates.get(userId);
            if (!userState || userState.state !== 'awaiting_stream') return;

            // Update state
            userState.state = 'awaiting_payment_method';
            userState.data.studentType = stream;
            userState.data.registrationStep = 'awaiting_payment_method';
            userStates.set(userId, userState);

            // Save to database
            await UserService.setUser(userId, userState.data);

            // Request payment method
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📱 TeleBirr', callback_data: 'payment_telebirr' }],
                        [{ text: '🏦 CBE Birr', callback_data: 'payment_cbebirr' }]
                    ]
                },
                parse_mode: 'Markdown'
            };

            await bot.editMessageText(
                `✅ Stream saved: *${stream.toUpperCase()}*\n\n💳 *SELECT PAYMENT METHOD*\n\nChoose your preferred payment platform:`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    reply_markup: options.reply_markup,
                    parse_mode: 'Markdown'
                }
            );

        } catch (error) {
            console.error('❌ Stream selection error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing selection' });
        }
    },

    // Handle payment method selection
    async handlePaymentMethodSelection(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const paymentMethod = callbackQuery.data.split('_')[1];

        try {
            const userState = userStates.get(userId);
            if (!userState || userState.state !== 'awaiting_payment_method') return;

            // Update state
            userState.state = 'completed';
            userState.data.paymentMethod = paymentMethod;
            userState.data.registrationStep = 'completed';
            userStates.set(userId, userState);

            // Save to database
            await UserService.setUser(userId, userState.data);

            // Clear state
            userStates.delete(userId);

            // Send success message
            await bot.editMessageText(MessageHelper.getMessage('REG_SUCCESS'), {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown'
            });

            // Show main menu
            await showMainMenu(chatId);

        } catch (error) {
            console.error('❌ Payment method error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing payment method' });
        }
    },

    // Handle registration callbacks
    async handleRegistrationCallback(callbackQuery) {
        const data = callbackQuery.data;

        if (data.startsWith('stream_')) {
            await this.handleStreamSelection(callbackQuery);
            return true;
        } else if (data.startsWith('payment_')) {
            await this.handlePaymentMethodSelection(callbackQuery);
            return true;
        }

        return false;
    },

    // Navigation handlers
    async handleCancelRegistration(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Clear registration state
        userStates.delete(userId);

        // Reset user data
        await UserService.setUser(userId, {
            registrationStep: 'not_started',
            paymentStatus: 'not_started'
        });

        await bot.sendMessage(chatId, "❌ Registration cancelled. Returning to main menu.", { parse_mode: 'Markdown' });
        await showMainMenu(chatId);
    },

    async handleHomepage(msg) {
        const chatId = msg.chat.id;
        await showMainMenu(chatId);
    },

    // Handle navigation messages
    async handleNavigation(msg) {
        const text = msg.text;

        if (text === MessageHelper.getButtonText('CANCEL_REG')) {
            await this.handleCancelRegistration(msg);
            return true;
        } else if (text === MessageHelper.getButtonText('HOMEPAGE')) {
            await this.handleHomepage(msg);
            return true;
        }

        return false;
    }
};

module.exports = RegistrationHandler;
