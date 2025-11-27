const bot = require('../config/bot');
const { getUser, setUser } = require('../database/users');
const { REGISTRATION_FEE } = require('../config/environment');
const { showMainMenu } = require('./menu');
const MessageHelper = require('../utils/messageHelper');
const { validateName, checkFeatureStatus } = require('../utils/helpers');

// --- Step 1: Start Registration ---
const handleRegisterTutorial = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);

    const feature = checkFeatureStatus('registration');
    if (!feature.allowed) {
        await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
        return;
    }

    if (user?.isVerified) {
        await bot.sendMessage(chatId, `✅ *You are already registered!*`, { parse_mode: 'Markdown' });
        return;
    }

    // Reset user data and start the flow
    const userData = {
        telegramId: userId,
        firstName: msg.from.first_name,
        username: msg.from.username || null,
        isVerified: false,
        registrationStep: 'awaiting_name',
        paymentStatus: 'not_started',
        name: null,
        phone: null,
        studentType: null,
        paymentMethod: null,
        referralCount: user?.referralCount || 0,
        rewards: user?.rewards || 0,
        referrerId: user?.referrerId || null,
        joinedAt: user?.joinedAt || new Date()
    };
    await setUser(userId, userData);

    const regStartMessage = MessageHelper.getMessage('REG_START');
    await bot.sendMessage(chatId, regStartMessage, { parse_mode: 'Markdown' });
};

// --- Step 2: Receive Name Input ---
const handleNameInput = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);
    const name = msg.text.trim();

    if (!validateName(name)) {
        await bot.sendMessage(chatId, '❌ *Invalid Name.* Please enter your full name (2-50 characters).', { parse_mode: 'Markdown' });
        return;
    }

    user.name = name;
    user.registrationStep = 'awaiting_phone';
    await setUser(userId, user);

    const nameSavedMessage = MessageHelper.getMessage('REG_NAME_SAVED', { name: name });
    
    // Request contact button
    const options = {
        reply_markup: {
            keyboard: MessageHelper.getRegistrationButtons(),
            resize_keyboard: true,
            one_time_keyboard: true
        },
        parse_mode: 'Markdown'
    };

    await bot.sendMessage(chatId, nameSavedMessage, options);
};

// --- Step 3: Receive Contact ---
const handleContactShared = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);
    const contact = msg.contact;

    if (user?.registrationStep !== 'awaiting_phone' || contact.user_id !== userId) {
        await bot.sendMessage(chatId, '❌ *Please share your OWN phone number* using the button.', { parse_mode: 'Markdown' });
        return;
    }

    user.phone = contact.phone_number;
    user.registrationStep = 'awaiting_stream';
    await setUser(userId, user);

    const phoneSavedMessage = MessageHelper.getMessage('REG_PHONE_SAVED', { phone: contact.phone_number });

    // Stream Selection
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Natural Science', callback_data: 'stream_natural' }],
                [{ text: 'Social Science', callback_data: 'stream_social' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    await bot.sendMessage(chatId, phoneSavedMessage, options);
};

// --- Step 4: Stream Selection (Callback) ---
const handleStreamSelection = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    const user = await getUser(userId);
    const stream = data.split('_')[1];

    if (user?.registrationStep !== 'awaiting_stream') { return; }

    user.studentType = stream;
    user.registrationStep = 'awaiting_payment_method';
    await setUser(userId, user);

    // Payment Method Selection
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'TeleBirr', callback_data: 'payment_telebirr' }],
                [{ text: 'CBE Birr', callback_data: 'payment_cbebirr' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    await bot.editMessageText(`✅ Stream saved: *${stream.toUpperCase()}*\\n\\n💳 *SELECT PAYMENT METHOD*\\n\\nChoose your preferred payment platform:`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: options.reply_markup,
        parse_mode: 'Markdown'
    });
};

// --- Step 5: Payment Method Selection (Callback) ---
const handlePaymentMethodSelection = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    const user = await getUser(userId);
    const paymentMethod = data.split('_')[1];

    if (user?.registrationStep !== 'awaiting_payment_method') { return; }

    user.paymentMethod = paymentMethod;
    user.registrationStep = 'completed'; // Now they proceed to payment.js logic
    await setUser(userId, user);
    
    // Notify user registration is structurally complete
    const regSuccessMessage = MessageHelper.getMessage('REG_SUCCESS');
    await bot.editMessageText(regSuccessMessage, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
    });
    
    // Send them to the main menu
    await showMainMenu(chatId);
};

// --- Navigation Handlers ---

const handleCancelRegistration = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Clear registration data
    const userData = {
        registrationStep: 'not_started',
        paymentStatus: 'not_started',
        name: null,
        phone: null,
        studentType: null,
        paymentMethod: null
    };
    await setUser(userId, userData);

    await bot.sendMessage(chatId, '❌ Registration cancelled. Returning to main menu.', { parse_mode: 'Markdown' });
    await showMainMenu(chatId);
};

const handleHomepage = async (msg) => {
    const chatId = msg.chat.id;
    await showMainMenu(chatId);
};

const handleNavigation = async (msg) => {
    const text = msg.text;
    
    if (text === MessageHelper.getButtonText('CANCEL_REG')) {
        await handleCancelRegistration(msg);
        return true;
    } else if (text === MessageHelper.getButtonText('HOMEPAGE')) {
        await handleHomepage(msg);
        return true;
    }
    return false;
};

// Consolidated callback router
const handleRegistrationCallback = async (callbackQuery) => {
    const data = callbackQuery.data;
    if (data.startsWith('stream_')) {
        await handleStreamSelection(callbackQuery);
        return true;
    } else if (data.startsWith('payment_')) {
        await handlePaymentMethodSelection(callbackQuery);
        return true;
    }
    return false;
};


module.exports = {
    handleRegisterTutorial,
    handleNameInput,
    handleContactShared,
    handleNavigation,
    handleRegistrationCallback
};
