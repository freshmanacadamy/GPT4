const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const PaymentService = require('../database/payments');
const WithdrawalService = require('../database/withdrawals');
const { ADMIN_IDS, MASTER_ADMIN_IDS, REFERRAL_REWARD } = require('../config/environment');
const { sendDailyStatsToAdmins } = require('../utils/notifications');
const { formatCurrency } = require('../utils/helpers');

const AdminHandler = {
    // Handle admin panel command
    async handleAdminPanel(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            if (!ADMIN_IDS.includes(userId)) {
                await bot.sendMessage(chatId, '❌ Access denied.', { parse_mode: 'Markdown' });
                return;
            }

            // Get quick stats
            const [allUsers, verifiedUsers, pendingPayments, pendingWithdrawals] = await Promise.all([
                UserService.getAllUsers(),
                UserService.getVerifiedUsers(),
                PaymentService.getPendingPayments(),
                WithdrawalService.getPendingWithdrawals()
            ]);

            const userCount = Object.keys(allUsers).length;
            const verifiedCount = verifiedUsers.length;
            const pendingPaymentsCount = pendingPayments.length;
            const pendingWithdrawalsCount = pendingWithdrawals.length;

            const statsMessage = 
                "👑 *ADMIN PANEL*\n\n" +
                "📊 *Quick Stats:*\n" +
                `• Total Users: ${userCount}\n` +
                `• Verified: ${verifiedCount}\n` +
                `• Pending Payments: ${pendingPaymentsCount}\n` +
                `• Pending Withdrawals: ${pendingWithdrawalsCount}\n\n` +
                "⚡ *Admin Tools:*";

            const { getButtonText } = require('../utils/messageHelper');
            const options = {
                reply_markup: {
                    keyboard: [
                        [{ text: getButtonText('MANAGE_STUDENTS') }, { text: getButtonText('REVIEW_PAYMENTS') }],
                        [{ text: getButtonText('BOT_SETTINGS') }, { text: getButtonText('STUDENT_STATS') }],
                        [{ text: getButtonText('BROADCAST') }],
                        [{ text: getButtonText('HOMEPAGE') }]
                    ],
                    resize_keyboard: true
                },
                parse_mode: 'Markdown'
            };

            await bot.sendMessage(chatId, statsMessage, options);

        } catch (error) {
            console.error('❌ Admin panel error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle daily stats command
    async handleDailyStatsCommand(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            if (!ADMIN_IDS.includes(userId)) return;

            await sendDailyStatsToAdmins(chatId);

        } catch (error) {
            console.error('❌ Daily stats error:', error);
            await bot.sendMessage(chatId, '❌ Error generating daily stats.');
        }
    },

    // Handle payment approval
    async handleAdminApprovePayment(callbackQuery) {
        const adminId = callbackQuery.from.id;
        const paymentId = callbackQuery.data.split('_')[3];

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing approval...' });

            if (!ADMIN_IDS.includes(adminId)) return;

            const payment = await PaymentService.getPaymentById(paymentId);
            if (!payment || payment.status !== 'pending') return;

            const userId = payment.userId;
            
            // Update payment status
            await PaymentService.setPayment(paymentId, { 
                status: 'approved', 
                approvedBy: adminId.toString(), 
                approvalTimestamp: new Date().toISOString() 
            });

            // Update user status
            await UserService.setUser(userId, { 
                isVerified: true, 
                paymentStatus: 'approved',
                joinedAt: new Date() 
            });

            // Process referral reward
            await this.processReferralReward(userId);

            // Update admin message
            const newCaption = callbackQuery.message.caption + 
                `\n\n✅ *APPROVED* by Admin on ${new Date().toLocaleString()}`;

            await bot.editMessageCaption(newCaption, { 
                chat_id: callbackQuery.message.chat.id, 
                message_id: callbackQuery.message.message_id, 
                parse_mode: 'Markdown' 
            });

            // Notify user
            try {
                await bot.sendMessage(userId, 
                    "🎉 *PAYMENT APPROVED!*\n\n" +
                    "✅ Your account is now verified and active!\n\n" +
                    "You now have full access to all bot features.",
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.log('User notification failed (might have blocked bot)');
            }

        } catch (error) {
            console.error('❌ Payment approval error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error approving payment' });
        }
    },

    // Handle payment rejection
    async handleAdminRejectPayment(callbackQuery) {
        const adminId = callbackQuery.from.id;
        const paymentId = callbackQuery.data.split('_')[3];

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Processing rejection...' });

            if (!ADMIN_IDS.includes(adminId)) return;

            const payment = await PaymentService.getPaymentById(paymentId);
            if (!payment || payment.status !== 'pending') return;

            const userId = payment.userId;

            // Update payment status
            await PaymentService.setPayment(paymentId, { 
                status: 'rejected', 
                rejectedBy: adminId.toString(), 
                rejectionTimestamp: new Date().toISOString() 
            });

            // Update user status
            await UserService.setUser(userId, { 
                paymentStatus: 'rejected',
                registrationStep: 'awaiting_payment_method'
            });

            // Update admin message
            const newCaption = callbackQuery.message.caption + 
                `\n\n❌ *REJECTED* by Admin on ${new Date().toLocaleString()}`;

            await bot.editMessageCaption(newCaption, { 
                chat_id: callbackQuery.message.chat.id, 
                message_id: callbackQuery.message.message_id, 
                parse_mode: 'Markdown' 
            });

            // Notify user
            try {
                await bot.sendMessage(userId, 
                    "❌ *PAYMENT REJECTED*\n\n" +
                    "Your payment proof was rejected by admin.\n\n" +
                    "Please ensure:\n" +
                    "• Screenshot is clear and readable\n" +
                    "• Amount matches registration fee\n" +
                    "• Transaction details are visible\n\n" +
                    "You can upload a new screenshot.",
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.log('User notification failed');
            }

        } catch (error) {
            console.error('❌ Payment rejection error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error rejecting payment' });
        }
    },

    // Process referral reward when user is approved
    async processReferralReward(userId) {
        try {
            const user = await UserService.getUser(userId);
            if (!user?.referrerId) return;

            const referrerId = parseInt(user.referrerId);
            const referrer = await UserService.getUser(referrerId);
            
            if (referrer) {
                const newReferralCount = (referrer.referralCount || 0) + 1;
                const newRewards = (referrer.rewards || 0) + REFERRAL_REWARD;

                await UserService.setUser(referrerId, {
                    referralCount: newReferralCount,
                    rewards: newRewards,
                    totalRewards: (referrer.totalRewards || 0) + REFERRAL_REWARD
                });

                // Notify referrer
                try {
                    await bot.sendMessage(referrerId,
                        `🎁 *REFERRAL REWARD!*\n\n` +
                        `Your referred student (*${user.name}*) has been verified!\n\n` +
                        `💰 You earned ${formatCurrency(REFERRAL_REWARD)}\n` +
                        `📈 Total Referrals: ${newReferralCount}\n` +
                        `💵 Total Rewards: ${formatCurrency(newRewards)}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {
                    console.log('Referrer notification failed');
                }
            }
        } catch (error) {
            console.error('❌ Referral reward error:', error);
        }
    },

    // Handle student management
    async handleStudentManagement(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            if (!ADMIN_IDS.includes(userId)) return;

            const allUsers = await UserService.getAllUsers();
            const userCount = Object.keys(allUsers).length;
            const verifiedCount = Object.values(allUsers).filter(u => u.isVerified).length;

            const message = 
                "👥 *STUDENT MANAGEMENT*\n\n" +
                `📊 Total Students: ${userCount}\n` +
                `✅ Verified: ${verifiedCount}\n` +
                `⏳ Pending: ${userCount - verifiedCount}\n\n` +
                "⚡ *Quick Actions:*";

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View All Students', callback_data: 'admin_view_students' }],
                        [{ text: '✅ View Verified Only', callback_data: 'admin_view_verified' }],
                        [{ text: '⏳ View Pending Only', callback_data: 'admin_view_pending' }],
                        [{ text: '📊 Student Statistics', callback_data: 'admin_student_stats' }],
                        [{ text: '🔙 Back to Admin Panel', callback_data: 'admin_back_panel' }]
                    ]
                }
            };

            await bot.sendMessage(chatId, message, options);

        } catch (error) {
            console.error('❌ Student management error:', error);
            await bot.sendMessage(chatId, '❌ Error loading student management.');
        }
    },

    // Handle view students list
    async handleViewStudents(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const filter = callbackQuery.data.split('_')[2]; // all, verified, pending

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading students...' });

            if (!ADMIN_IDS.includes(userId)) return;

            const allUsers = await UserService.getAllUsers();
            let users = Object.entries(allUsers);

            // Apply filter
            if (filter === 'verified') {
                users = users.filter(([_, user]) => user.isVerified);
            } else if (filter === 'pending') {
                users = users.filter(([_, user]) => !user.isVerified);
            }

            if (users.length === 0) {
                await bot.sendMessage(chatId, `❌ No students found with the selected filter.`, { parse_mode: 'Markdown' });
                return;
            }

            // Paginate results (10 per page)
            const page = 0;
            const pageSize = 10;
            const paginatedUsers = users.slice(page * pageSize, (page + 1) * pageSize);

            let message = `👥 *STUDENTS LIST* (${users.length} total)\n\n`;
            message += `Filter: ${filter.toUpperCase()}\n\n`;

            const inline_keyboard = paginatedUsers.map(([id, user]) => [
                { 
                    text: `${user.isVerified ? '✅' : '⏳'} ${user.name || 'Unknown'}`, 
                    callback_data: `admin_student_details_${id}` 
                }
            ]);

            // Add navigation buttons
            if (users.length > pageSize) {
                inline_keyboard.push([
                    { text: '⬅️ Previous', callback_data: `admin_students_${filter}_${page-1}` },
                    { text: 'Next ➡️', callback_data: `admin_students_${filter}_${page+1}` }
                ]);
            }

            inline_keyboard.push([
                { text: '🔙 Back to Management', callback_data: 'admin_back_management' }
            ]);

            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard }
            });

        } catch (error) {
            console.error('❌ View students error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error loading students' });
        }
    },

    // Handle student details
    async handleStudentDetails(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const adminId = callbackQuery.from.id;
        const studentId = callbackQuery.data.split('_')[3];

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading student details...' });

            if (!ADMIN_IDS.includes(adminId)) return;

            const student = await UserService.getUser(studentId);
            if (!student) {
                await bot.sendMessage(chatId, '❌ Student not found.', { parse_mode: 'Markdown' });
                return;
            }

            const joinedDate = student.joinedAt ? new Date(student.joinedAt.seconds * 1000).toLocaleDateString() : 'Unknown';
            const referrer = student.referrerId ? await UserService.getUser(parseInt(student.referrerId)) : null;

            const message = 
                `👤 *STUDENT DETAIL REPORT*\n\n` +
                `📋 *Basic Info:*\n` +
                `• Name: ${student.name || 'Not set'}\n` +
                `• Phone: ${student.phone || 'Not set'}\n` +
                `• Stream: ${student.studentType ? student.studentType.toUpperCase() : 'Not set'}\n` +
                `• Status: ${student.isVerified ? '✅ Verified' : '⏳ Pending'}\n` +
                `• Joined: ${joinedDate}\n\n` +
                `💰 *Financial Info:*\n` +
                `• Rewards: ${formatCurrency(student.rewards || 0)}\n` +
                `• Referrals: ${student.referralCount || 0}\n` +
                `• Payment Method: ${student.paymentMethod || 'Not set'}\n\n` +
                `👥 *Referral Info:*\n` +
                `• Referred by: ${referrer ? referrer.name : 'Organic'}\n` +
                `• Referrer ID: ${student.referrerId || 'N/A'}\n\n` +
                `🆔 Student ID: \`${studentId}\``;

            const inline_keyboard = [
                [
                    { text: '🗑️ Delete Student', callback_data: `admin_delete_student_${studentId}` },
                    { text: '🚫 Block Student', callback_data: `admin_block_student_${studentId}` }
                ],
                [
                    { text: '📞 Contact Student', callback_data: `admin_contact_student_${studentId}` }
                ],
                [
                    { text: '🔙 Back to List', callback_data: 'admin_back_students' }
                ]
            ];

            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard }
            });

        } catch (error) {
            console.error('❌ Student details error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error loading student details' });
        }
    },

    // Handle admin callbacks
    async handleAdminCallback(callbackQuery) {
        const data = callbackQuery.data;

        if (data.startsWith('admin_approve_payment_')) {
            await this.handleAdminApprovePayment(callbackQuery);
            return true;
        } else if (data.startsWith('admin_reject_payment_')) {
            await this.handleAdminRejectPayment(callbackQuery);
            return true;
        } else if (data.startsWith('admin_view_')) {
            await this.handleViewStudents(callbackQuery);
            return true;
        } else if (data.startsWith('admin_student_details_')) {
            await this.handleStudentDetails(callbackQuery);
            return true;
        } else if (data === 'admin_back_panel') {
            await this.handleAdminPanel({ 
                chat: { id: callbackQuery.message.chat.id }, 
                from: callbackQuery.from 
            });
            return true;
        } else if (data === 'admin_back_management') {
            await this.handleStudentManagement({ 
                chat: { id: callbackQuery.message.chat.id }, 
                from: callbackQuery.from 
            });
            return true;
        }

        return false;
    }
};

module.exports = AdminHandler;
