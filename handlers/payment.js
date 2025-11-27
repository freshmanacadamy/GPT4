const bot = require('../config/bot');
const { getUser, setUser } = require('../database/users');
const { addPayment } = require('../database/payments');
const { notifyAdminsNewPayment } = require('../utils/notifications');
const { REGISTRATION_FEE } = require('../config/environment');
const { formatCurrency } = require('../utils/helpers');

// --- Main Pay Fee Button Handler ---
const handlePayFee = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);

    if (user?.isVerified) {
        await bot.sendMessage(chatId, `✅ *You are already registered!*`, { parse_mode: 'Markdown' });
        return;
    }
    
    if (user?.paymentStatus === 'pending') {
         await bot.sendMessage(chatId, `⏳ *PAYMENT PENDING APPROVAL*\\n\\nYour screenshot is currently being reviewed. Please wait for the admin.`, { parse_mode: 'Markdown' });
         return;
    }

    if (!user?.paymentMethod) {
        await bot.sendMessage(chatId, `❌ *Please complete registration first*\\n\\nUse the '📝 Register' button to start.`, { parse_mode: 'Markdown' });
        return;
    }

    const payFeeMessage = 
        `💰 *PAYMENT INFORMATION*\\n\\n` +
        `Registration Fee: *${formatCurrency(REGISTRATION_FEE)}*\\n\\n` +
        `📱 *Payment Method Selected:*\\n` +
        `• *${user.paymentMethod.toUpperCase()}*\\n\\n` +
        `➡️ *Instructions:*\\n` +
        `1. Send ${REGISTRATION_FEE} ETB to the following account (use your registered phone *${user.phone}* for *TeleBirr*):\\n` +
        `   • TeleBirr: +251 9XX XXX XXXX (Example)\\n` +
        `   • CBE Birr: 1000 XXXXXXXX (Example)\\n` +
        `2. Take a clear screenshot of the transaction receipt.\\n` +
        `3. *Upload the screenshot now.*`;

    // Set the user state to waiting for screenshot
    user.registrationStep = 'awaiting_screenshot';
    await setUser(userId, user);

    await bot.sendMessage(chatId, payFeeMessage, { parse_mode: 'Markdown' });
};

// --- Screenshot Upload Handler ---
const handlePaymentScreenshot = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);
    let file_id = null;

    if (user?.registrationStep !== 'awaiting_screenshot') { return; }

    // Check for photo or document
    if (msg.photo && msg.photo.length > 0) {
        file_id = msg.photo[msg.photo.length - 1].file_id; // Get the highest resolution photo
    } else if (msg.document) {
        file_id = msg.document.file_id;
    }

    if (file_id) {
        // 1. Add payment record to database
        const paymentData = {
            userId: userId,
            amount: REGISTRATION_FEE,
            method: user.paymentMethod,
            fileId: file_id,
            status: 'pending'
        };
        const paymentId = await addPayment(paymentData);

        // 2. Update user status in database
        user.paymentStatus = 'pending';
        user.registrationStep = 'completed'; // Move out of stateful awaiting mode
        await setUser(userId, user);

        // 3. Notify user
        await bot.sendMessage(chatId,
            `✅ *SCREENSHOT SUBMITTED!*\\n\\n` +
            `We have received your payment proof (ID: ${paymentId}).\\n` +
            `Your payment status is now *pending approval*.\\n\n` +
            `⏳ The admin will review it shortly.`,
            { parse_mode: 'Markdown' }
        );

        // 4. Notify admins and provide approval buttons
        await notifyAdminsNewPayment(user, file_id, paymentId);
    } else {
        await bot.sendMessage(chatId,
            `❌ *Please send a valid image or document.*\\n\\n` +
            `Send a clear screenshot of your payment.`,
            { parse_mode: 'Markdown' }
        );
    }
};

module.exports = {
    handlePayFee,
    handlePaymentScreenshot
};
