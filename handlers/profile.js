const bot = require('../config/bot');
const { getUser, setUser } = require('../database/users');
const { addWithdrawalRequest } = require('../database/withdrawals');
const { REFERRAL_REWARD, MIN_REFERRALS_FOR_WITHDRAW, MIN_WITHDRAWAL_AMOUNT } = require('../config/environment');
const { getFirebaseTimestamp, formatCurrency, checkFeatureStatus } = require('../utils/helpers');

// State machine for withdrawal process
const withdrawalState = new Map(); // Stores { userId: 'awaiting_method' | 'awaiting_account' | 'awaiting_name' }

// --- My Profile Button Handler ---
const handleMyProfile = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);

    if (!user) {
        await bot.sendMessage(chatId, '❌ Please start the bot with /start first.', { parse_mode: 'Markdown' });
        return;
    }

    const minWithdrawalAmount = MIN_WITHDRAWAL_AMOUNT;
    const canWithdraw = (user?.rewards || 0) >= minWithdrawalAmount;
    
    const profileMessage = 
        `👤 *MY PROFILE*\\n\\n` +
        `📋 Name: ${user.name || 'Not set'}\\n` +
        `📱 Phone: ${user.phone || 'Not set'}\\n` +
        `🎓 Stream: ${user.studentType ? user.studentType.toUpperCase() : 'Not set'}\\n` +
        `✅ Status: ${user.isVerified ? '✅ Verified' : '⏳ Pending Approval'}\\n` +
        `👥 Referrals: ${user.referralCount || 0}\\n` +
        `💰 Rewards: *${formatCurrency(user.rewards || 0)}*\\n` +
        `📊 Joined: ${user.joinedAt ? getFirebaseTimestamp(user.joinedAt).toLocaleDateString() : 'N/A'}\\n\\n` +
        `💳 *Preferred Payment:*\\n` +
        `• Method: ${user.paymentMethodPreference || 'Not set'}\\n` +
        `• Account: ${user.accountNumber || 'Not set'}\\n` +
        `• Name: ${user.accountName || 'Not set'}\\n\\n` +
        `*Min Withdrawal: ${formatCurrency(minWithdrawalAmount)}*`;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💸 Withdraw Rewards', callback_data: 'profile_withdraw_start' }],
                [{ text: '💳 Change Payment Info', callback_data: 'profile_change_payment' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    
    await bot.sendMessage(chatId, profileMessage, options);
};

// --- Withdrawal Logic Start (Callback) ---
const handleWithdrawalStart = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const user = await getUser(userId);

    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting withdrawal process...' });
    
    const feature = checkFeatureStatus('withdrawal');
    if (!feature.allowed) {
        await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
        return;
    }

    const minWithdrawalAmount = MIN_WITHDRAWAL_AMOUNT;

    if (!user?.isVerified) {
        await bot.sendMessage(chatId, '❌ *Withdrawal Denied.* You must be a verified student.', { parse_mode: 'Markdown' });
    } else if ((user.rewards || 0) < minWithdrawalAmount) {
        await bot.sendMessage(chatId, `❌ *Withdrawal Denied.* Minimum withdrawal is ${formatCurrency(minWithdrawalAmount)}. You have ${formatCurrency(user.rewards || 0)}.`, { parse_mode: 'Markdown' });
    } else if (!user.accountNumber || !user.accountName || !user.paymentMethodPreference) {
        await bot.sendMessage(chatId, '❌ *Missing Payment Info.* Please use the "💳 Change Payment Info" button before withdrawing.', { parse_mode: 'Markdown' });
    } else {
        // Create withdrawal request
        const withdrawalData = {
            userId: userId,
            amount: user.rewards, // Withdraw all current rewards
            method: user.paymentMethodPreference,
            accountNumber: user.accountNumber,
            accountName: user.accountName,
            status: 'pending'
        };
        const withdrawalId = await addWithdrawalRequest(withdrawalData);
        
        // Zero out user rewards
        await setUser(userId, { rewards: 0 });

        await bot.sendMessage(chatId, 
            `✅ *WITHDRAWAL REQUEST SUBMITTED!*\\n\\n` +
            `💸 Amount: *${formatCurrency(withdrawalData.amount)}*\\n` +
            `💳 Method: *${withdrawalData.method}*\\n` +
            `⏳ We are processing your payment. This typically takes 24-48 hours.`
            , { parse_mode: 'Markdown' }
        );
        // TODO: Notify admins about the new withdrawal request
    }
};

// --- Change Payment Info Start (Callback) ---
const handleChangePaymentStart = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Updating payment method...' });
    
    // Step 1: Ask for method
    withdrawalState.set(userId, 'awaiting_method');

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'TeleBirr', callback_data: 'payment_update_telebirr' }],
                [{ text: 'CBE Birr', callback_data: 'payment_update_cbebirr' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    
    await bot.sendMessage(chatId, '💳 *STEP 1: SELECT NEW PAYMENT METHOD*', options);
};

// --- Handle Payment Method Update (Callback) ---
const handlePaymentMethodUpdate = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const method = callbackQuery.data.split('_')[2]; // e.g., payment_update_telebirr

    if (withdrawalState.get(userId) !== 'awaiting_method') { return; }

    // Save method and ask for account number
    await setUser(userId, { paymentMethodPreference: method });
    withdrawalState.set(userId, 'awaiting_account');

    await bot.editMessageText(`✅ Method set: *${method.toUpperCase()}*\\n\\n📱 *STEP 2: ENTER ACCOUNT NUMBER*\\n\\nPlease send the ${method} phone number or bank account number.`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
    });
};

// --- Handle Account Number Input (Text) ---
const handleAccountInput = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const accountNumber = msg.text.trim();

    if (withdrawalState.get(userId) !== 'awaiting_account') { return; }
    
    // Basic validation (can be more rigorous)
    if (accountNumber.length < 5 || accountNumber.length > 20) {
        await bot.sendMessage(chatId, '❌ Invalid account number. Please check and send again.', { parse_mode: 'Markdown' });
        return;
    }

    // Save account number and ask for account name
    await setUser(userId, { accountNumber: accountNumber });
    withdrawalState.set(userId, 'awaiting_name');

    await bot.sendMessage(chatId, 
        `✅ Account number set.\\n\\n👤 *STEP 3: ENTER ACCOUNT NAME*\\n\\nPlease send the full name registered on this account.`
        , { parse_mode: 'Markdown' }
    );
};

// --- Handle Account Name Input (Text) ---
const handleAccountNameInput = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const accountName = msg.text.trim();

    if (withdrawalState.get(userId) !== 'awaiting_name') { return; }
    
    // Save account name and clear state
    await setUser(userId, { accountName: accountName });
    withdrawalState.delete(userId);

    await bot.sendMessage(chatId, 
        `🎉 *PAYMENT INFO UPDATED!*\\n\\nYour new payment details are saved.`
        , { parse_mode: 'Markdown' }
    );
};

// --- Main Handler to route text messages based on state ---
const handleProfileText = async (msg) => {
    const userId = msg.from.id;
    const state = withdrawalState.get(userId);

    if (state === 'awaiting_account') {
        await handleAccountInput(msg);
        return true;
    } else if (state === 'awaiting_name') {
        await handleAccountNameInput(msg);
        return true;
    }
    return false;
};

// --- Main Handler to route callback queries ---
const handleProfileCallback = async (callbackQuery) => {
    const data = callbackQuery.data;
    
    if (data === 'profile_withdraw_start') {
        await handleWithdrawalStart(callbackQuery);
        return true;
    } else if (data === 'profile_change_payment') {
        await handleChangePaymentStart(callbackQuery);
        return true;
    } else if (data.startsWith('payment_update_')) {
        await handlePaymentMethodUpdate(callbackQuery);
        return true;
    }
    return false;
};


module.exports = {
    handleMyProfile,
    handleProfileText, // Exported to be called by api.js handleMessage
    handleProfileCallback // Exported to be called by api.js handleCallbackQuery
};
