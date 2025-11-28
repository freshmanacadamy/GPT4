const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const WithdrawalService = require('../database/withdrawals');
const { REFERRAL_REWARD, MIN_REFERRALS_FOR_WITHDRAW, MIN_WITHDRAWAL_AMOUNT } = require('../config/environment');
const { formatCurrency, checkFeatureStatus } = require('../utils/helpers');

// Withdrawal state machine
const withdrawalState = new Map();

const ProfileHandler = {
    // Handle my profile button
    async handleMyProfile(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            const user = await UserService.getUser(userId);

            if (!user) {
                await bot.sendMessage(chatId, '❌ Please start the bot with /start first.', { parse_mode: 'Markdown' });
                return;
            }

            const minWithdrawalAmount = MIN_WITHDRAWAL_AMOUNT;
            const canWithdraw = (user.rewards || 0) >= minWithdrawalAmount;
            const joinedDate = user.joinedAt ? new Date(user.joinedAt.seconds * 1000).toLocaleDateString() : 'N/A';

            const profileMessage = 
                `👤 *MY PROFILE*\n\n` +
                `📋 Name: ${user.name || 'Not set'}\n` +
                `📱 Phone: ${user.phone || 'Not set'}\n` +
                `🎓 Stream: ${user.studentType ? user.studentType.toUpperCase() : 'Not set'}\n` +
                `✅ Status: ${user.isVerified ? '✅ Verified' : '⏳ Pending Approval'}\n` +
                `👥 Referrals: ${user.referralCount || 0}\n` +
                `💰 Rewards: *${formatCurrency(user.rewards || 0)}*\n` +
                `📊 Joined: ${joinedDate}\n\n` +
                `💳 *Payment Info:*\n` +
                `• Method: ${user.paymentMethodPreference || 'Not set'}\n` +
                `• Account: ${user.accountNumber || 'Not set'}\n` +
                `• Name: ${user.accountName || 'Not set'}\n\n` +
                `*Minimum Withdrawal: ${formatCurrency(minWithdrawalAmount)}*`;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💸 Withdraw Rewards', callback_data: 'profile_withdraw_start' }],
                        [{ text: '💳 Update Payment Info', callback_data: 'profile_update_payment' }],
                        [{ text: '📊 Referral Stats', callback_data: 'referral_my_referrals' }]
                    ]
                }
            };

            await bot.sendMessage(chatId, profileMessage, options);

        } catch (error) {
            console.error('❌ Profile error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle withdrawal start
    async handleWithdrawalStart(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting withdrawal process...' });

            // Check feature status
            const feature = checkFeatureStatus('withdrawal');
            if (!feature.allowed) {
                await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
                return;
            }

            const user = await UserService.getUser(userId);

            // Validation checks
            if (!user?.isVerified) {
                await bot.sendMessage(chatId, '❌ *Withdrawal Denied.* You must be a verified student.', { parse_mode: 'Markdown' });
                return;
            }

            if ((user.rewards || 0) < MIN_WITHDRAWAL_AMOUNT) {
                await bot.sendMessage(chatId, 
                    `❌ *Withdrawal Denied.* Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL_AMOUNT)}. You have ${formatCurrency(user.rewards || 0)}.`, 
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            if (!user.accountNumber || !user.accountName || !user.paymentMethodPreference) {
                await bot.sendMessage(chatId, 
                    '❌ *Missing Payment Info.* Please update your payment information before withdrawing.', 
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Create withdrawal request
            const withdrawalData = {
                userId: userId,
                amount: user.rewards,
                method: user.paymentMethodPreference,
                accountNumber: user.accountNumber,
                accountName: user.accountName,
                userName: user.name,
                status: 'pending'
            };

            const withdrawalId = await WithdrawalService.addWithdrawalRequest(withdrawalData);

            if (withdrawalId) {
                // Reset user rewards
                await UserService.setUser(userId, { rewards: 0 });

                await bot.sendMessage(chatId, 
                    `✅ *WITHDRAWAL REQUEST SUBMITTED!*\n\n` +
                    `💸 Amount: *${formatCurrency(withdrawalData.amount)}*\n` +
                    `💳 Method: *${withdrawalData.method}*\n` +
                    `📋 Request ID: ${withdrawalId}\n\n` +
                    `⏳ We are processing your payment. This typically takes 24-48 hours.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await bot.sendMessage(chatId, '❌ Failed to submit withdrawal request. Please try again.');
            }

        } catch (error) {
            console.error('❌ Withdrawal start error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle payment info update start
    async handleUpdatePaymentStart(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Updating payment method...' });

            // Start payment update flow
            withdrawalState.set(userId, 'awaiting_payment_method');

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📱 TeleBirr', callback_data: 'payment_method_telebirr' }],
                        [{ text: '🏦 CBE Birr', callback_data: 'payment_method_cbebirr' }]
                    ]
                }
            };

            await bot.sendMessage(chatId, '💳 *STEP 1: SELECT PAYMENT METHOD*', options);

        } catch (error) {
            console.error('❌ Payment update start error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error starting payment update' });
        }
    },

    // Handle payment method selection
    async handlePaymentMethodSelection(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const method = callbackQuery.data.split('_')[2];

        try {
            if (withdrawalState.get(userId) !== 'awaiting_payment_method') return;

            // Save payment method
            await UserService.setUser(userId, { paymentMethodPreference: method });
            withdrawalState.set(userId, 'awaiting_account_number');

            await bot.editMessageText(
                `✅ Method set: *${method.toUpperCase()}*\n\n📱 *STEP 2: ENTER ACCOUNT NUMBER*\n\nPlease send your ${method} phone number or account number:`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown'
                }
            );

        } catch (error) {
            console.error('❌ Payment method selection error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error saving payment method' });
        }
    },

    // Handle account number input
    async handleAccountNumberInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const accountNumber = msg.text?.trim();

        try {
            if (withdrawalState.get(userId) !== 'awaiting_account_number') return;

            if (!accountNumber || accountNumber.length < 5) {
                await bot.sendMessage(chatId, '❌ Invalid account number. Please enter a valid number (min 5 characters).', { parse_mode: 'Markdown' });
                return;
            }

            // Save account number
            await UserService.setUser(userId, { accountNumber: accountNumber });
            withdrawalState.set(userId, 'awaiting_account_name');

            await bot.sendMessage(chatId,
                `✅ Account number saved.\n\n👤 *STEP 3: ENTER ACCOUNT NAME*\n\nPlease send the full name registered on this account:`,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            console.error('❌ Account number error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle account name input
    async handleAccountNameInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const accountName = msg.text?.trim();

        try {
            if (withdrawalState.get(userId) !== 'awaiting_account_name') return;

            if (!accountName || accountName.length < 2) {
                await bot.sendMessage(chatId, '❌ Invalid account name. Please enter a valid name.', { parse_mode: 'Markdown' });
                return;
            }

            // Save account name and complete the process
            await UserService.setUser(userId, { accountName: accountName });
            withdrawalState.delete(userId);

            await bot.sendMessage(chatId,
                `🎉 *PAYMENT INFO UPDATED!*\n\nYour payment details have been saved successfully.\n\nYou can now withdraw your rewards.`,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            console.error('❌ Account name error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle profile callbacks
    async handleProfileCallback(callbackQuery) {
        const data = callbackQuery.data;

        if (data === 'profile_withdraw_start') {
            await this.handleWithdrawalStart(callbackQuery);
            return true;
        } else if (data === 'profile_update_payment') {
            await this.handleUpdatePaymentStart(callbackQuery);
            return true;
        } else if (data.startsWith('payment_method_')) {
            await this.handlePaymentMethodSelection(callbackQuery);
            return true;
        }

        return false;
    },

    // Handle profile text messages (state-based)
    async handleProfileText(msg) {
        const userId = msg.from.id;
        const state = withdrawalState.get(userId);

        if (state === 'awaiting_account_number') {
            await this.handleAccountNumberInput(msg);
            return true;
        } else if (state === 'awaiting_account_name') {
            await this.handleAccountNameInput(msg);
            return true;
        }

        return false;
    }
};

module.exports = ProfileHandler;
