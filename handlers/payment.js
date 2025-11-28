const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const PaymentService = require('../database/payments');
const { notifyAdminsNewPayment } = require('../utils/notifications');
const { REGISTRATION_FEE } = require('../config/environment');
const { formatCurrency } = require('../utils/helpers');

const PaymentHandler = {
    // Handle pay fee button
    async handlePayFee(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            const user = await UserService.getUser(userId);

            // Check if already verified
            if (user?.isVerified) {
                await bot.sendMessage(chatId, "✅ *You are already registered and verified!*", { parse_mode: 'Markdown' });
                return;
            }

            // Check if payment is pending
            if (user?.paymentStatus === 'pending') {
                await bot.sendMessage(chatId, 
                    "⏳ *PAYMENT PENDING APPROVAL*\n\nYour payment is currently being reviewed. Please wait for admin approval.", 
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Check if registration is complete
            if (!user?.paymentMethod) {
                await bot.sendMessage(chatId, 
                    "❌ *Please complete registration first*\n\nUse the '📝 Register' button to start the registration process.", 
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Payment instructions
            const payFeeMessage = 
                `💰 *PAYMENT INFORMATION*\n\n` +
                `Registration Fee: *${formatCurrency(REGISTRATION_FEE)}*\n\n` +
                `📱 *Payment Method Selected:*\n` +
                `• *${user.paymentMethod.toUpperCase()}*\n\n` +
                `➡️ *Instructions:*\n` +
                `1. Send ${REGISTRATION_FEE} ETB using ${user.paymentMethod.toUpperCase()}\n` +
                `2. Take a clear screenshot of the transaction receipt\n` +
                `3. *Upload the screenshot now*`;

            // Update user state
            await UserService.setUser(userId, {
                registrationStep: 'awaiting_screenshot'
            });

            await bot.sendMessage(chatId, payFeeMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('❌ Pay fee error:', error);
            await bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
        }
    },

    // Handle payment screenshot upload
    async handlePaymentScreenshot(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            const user = await UserService.getUser(userId);
            if (user?.registrationStep !== 'awaiting_screenshot') return;

            let fileId = null;

            // Check for photo or document
            if (msg.photo && msg.photo.length > 0) {
                fileId = msg.photo[msg.photo.length - 1].file_id;
            } else if (msg.document) {
                fileId = msg.document.file_id;
            }

            if (!fileId) {
                await bot.sendMessage(chatId, 
                    "❌ *Please send a valid image or document.*\n\nSend a clear screenshot of your payment receipt.", 
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Create payment record
            const paymentData = {
                userId: userId,
                amount: REGISTRATION_FEE,
                method: user.paymentMethod,
                fileId: fileId,
                userName: user.name,
                userPhone: user.phone
            };

            const paymentId = await PaymentService.addPayment(paymentData);

            if (paymentId) {
                // Update user status
                await UserService.setUser(userId, {
                    paymentStatus: 'pending',
                    registrationStep: 'completed'
                });

                // Notify user
                await bot.sendMessage(chatId,
                    `✅ *SCREENSHOT SUBMITTED!*\n\n` +
                    `We have received your payment proof.\n` +
                    `Your payment status is now *pending approval*.\n\n` +
                    `⏳ The admin will review it shortly.`,
                    { parse_mode: 'Markdown' }
                );

                // Notify admins
                await notifyAdminsNewPayment(user, fileId, paymentId);
            } else {
                await bot.sendMessage(chatId, 
                    "❌ *Failed to submit payment.* Please try again.", 
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error('❌ Payment screenshot error:', error);
            await bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
        }
    }
};

module.exports = PaymentHandler;
