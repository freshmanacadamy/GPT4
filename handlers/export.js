const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const PaymentService = require('../database/payments');
const WithdrawalService = require('../database/withdrawals');
const { ADMIN_IDS } = require('../config/environment');
const { formatCurrency } = require('../utils/helpers');

const ExportHandler = {
    // Handle export command
    async handleExportData(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            if (!ADMIN_IDS.includes(userId)) return;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📊 Export User Data (CSV)', callback_data: 'export_users_csv' }],
                        [{ text: '📋 Export User Data (JSON)', callback_data: 'export_users_json' }],
                        [{ text: '💰 Export Payment History', callback_data: 'export_payments' }],
                        [{ text: '💸 Export Withdrawal History', callback_data: 'export_withdrawals' }],
                        [{ text: '📈 Export Statistics Report', callback_data: 'export_stats' }],
                        [{ text: '🔙 Back to Admin Panel', callback_data: 'admin_back_panel' }]
                    ]
                }
            };

            await bot.sendMessage(chatId,
                "📤 *DATA EXPORT SYSTEM*\n\n" +
                "Choose the data you want to export:",
                options
            );

        } catch (error) {
            console.error('❌ Export error:', error);
            await bot.sendMessage(chatId, '❌ Error loading export system.');
        }
    },

    // Handle export type selection
    async handleExportType(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const exportType = callbackQuery.data;

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Generating export...' });

            if (!ADMIN_IDS.includes(userId)) return;

            switch (exportType) {
                case 'export_users_csv':
                    await this.exportUsersCSV(chatId);
                    break;
                case 'export_users_json':
                    await this.exportUsersJSON(chatId);
                    break;
                case 'export_payments':
                    await this.exportPayments(chatId);
                    break;
                case 'export_withdrawals':
                    await this.exportWithdrawals(chatId);
                    break;
                case 'export_stats':
                    await this.exportStatistics(chatId);
                    break;
            }

        } catch (error) {
            console.error('❌ Export type error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error generating export' });
        }
    },

    // Export users as CSV
    async exportUsersCSV(chatId) {
        try {
            const allUsers = await UserService.getAllUsers();
            const users = Object.entries(allUsers);

            if (users.length === 0) {
                await bot.sendMessage(chatId, '❌ No user data to export.', { parse_mode: 'Markdown' });
                return;
            }

            // Create CSV header
            let csvContent = 'User ID,Name,Phone,Stream,Status,Referrals,Rewards,Joined Date,Referrer ID\n';

            // Add user data
            users.forEach(([userId, user]) => {
                const joinedDate = user.joinedAt ? new Date(user.joinedAt.seconds * 1000).toISOString().split('T')[0] : 'Unknown';
                const status = user.isVerified ? 'Verified' : 'Pending';
                
                csvContent += `"${userId}","${user.name || ''}","${user.phone || ''}","${user.studentType || ''}",`;
                csvContent += `"${status}","${user.referralCount || 0}","${user.rewards || 0}",`;
                csvContent += `"${joinedDate}","${user.referrerId || ''}"\n`;
            });

            // Send as document
            const buffer = Buffer.from(csvContent, 'utf-8');
            
            await bot.sendDocument(chatId, buffer, {
                caption: `📊 *User Data Export (CSV)*\n\nTotal Users: ${users.length}\nGenerated: ${new Date().toLocaleString()}`,
                parse_mode: 'Markdown',
                filename: `users_export_${Date.now()}.csv`
            });

        } catch (error) {
            console.error('❌ CSV export error:', error);
            await bot.sendMessage(chatId, '❌ Error generating CSV export.');
        }
    },

    // Export users as JSON
    async exportUsersJSON(chatId) {
        try {
            const allUsers = await UserService.getAllUsers();

            if (Object.keys(allUsers).length === 0) {
                await bot.sendMessage(chatId, '❌ No user data to export.', { parse_mode: 'Markdown' });
                return;
            }

            // Format user data
            const usersData = Object.entries(allUsers).map(([userId, user]) => ({
                id: userId,
                name: user.name,
                phone: user.phone,
                stream: user.studentType,
                status: user.isVerified ? 'verified' : 'pending',
                referrals: user.referralCount || 0,
                rewards: user.rewards || 0,
                joinedAt: user.joinedAt ? new Date(user.joinedAt.seconds * 1000).toISOString() : null,
                referrerId: user.referrerId,
                username: user.username,
                paymentMethod: user.paymentMethod
            }));

            const jsonContent = JSON.stringify(usersData, null, 2);
            const buffer = Buffer.from(jsonContent, 'utf-8');

            await bot.sendDocument(chatId, buffer, {
                caption: `📋 *User Data Export (JSON)*\n\nTotal Users: ${usersData.length}\nGenerated: ${new Date().toLocaleString()}`,
                parse_mode: 'Markdown',
                filename: `users_export_${Date.now()}.json`
            });

        } catch (error) {
            console.error('❌ JSON export error:', error);
            await bot.sendMessage(chatId, '❌ Error generating JSON export.');
        }
    },

    // Export payment history
    async exportPayments(chatId) {
        try {
            const payments = await PaymentService.getPendingPayments();
            const allPayments = await this.getAllPayments(); // Helper function to get all payments

            if (allPayments.length === 0) {
                await bot.sendMessage(chatId, '❌ No payment data to export.', { parse_mode: 'Markdown' });
                return;
            }

            let csvContent = 'Payment ID,User ID,User Name,Amount,Method,Status,Timestamp,Approved/Rejected By\n';

            allPayments.forEach(payment => {
                const timestamp = payment.timestamp ? new Date(payment.timestamp.seconds * 1000).toISOString() : 'Unknown';
                const approvedBy = payment.approvedBy || payment.rejectedBy || 'N/A';
                
                csvContent += `"${payment.id}","${payment.userId}","${payment.userName || ''}","${payment.amount || 0}",`;
                csvContent += `"${payment.method || ''}","${payment.status || ''}","${timestamp}","${approvedBy}"\n`;
            });

            const buffer = Buffer.from(csvContent, 'utf-8');

            await bot.sendDocument(chatId, buffer, {
                caption: `💰 *Payment History Export*\n\nTotal Payments: ${allPayments.length}\nGenerated: ${new Date().toLocaleString()}`,
                parse_mode: 'Markdown',
                filename: `payments_export_${Date.now()}.csv`
            });

        } catch (error) {
            console.error('❌ Payments export error:', error);
            await bot.sendMessage(chatId, '❌ Error generating payments export.');
        }
    },

    // Export withdrawal history
    async exportWithdrawals(chatId) {
        try {
            const withdrawals = await WithdrawalService.getPendingWithdrawals();
            const allWithdrawals = await this.getAllWithdrawals(); // Helper function to get all withdrawals

            if (allWithdrawals.length === 0) {
                await bot.sendMessage(chatId, '❌ No withdrawal data to export.', { parse_mode: 'Markdown' });
                return;
            }

            let csvContent = 'Withdrawal ID,User ID,User Name,Amount,Method,Account,Status,Timestamp\n';

            allWithdrawals.forEach(withdrawal => {
                const timestamp = withdrawal.timestamp ? new Date(withdrawal.timestamp.seconds * 1000).toISOString() : 'Unknown';
                
                csvContent += `"${withdrawal.id}","${withdrawal.userId}","${withdrawal.userName || ''}","${withdrawal.amount || 0}",`;
                csvContent += `"${withdrawal.method || ''}","${withdrawal.accountNumber || ''}","${withdrawal.status || ''}","${timestamp}"\n`;
            });

            const buffer = Buffer.from(csvContent, 'utf-8');

            await bot.sendDocument(chatId, buffer, {
                caption: `💸 *Withdrawal History Export*\n\nTotal Withdrawals: ${allWithdrawals.length}\nGenerated: ${new Date().toLocaleString()}`,
                parse_mode: 'Markdown',
                filename: `withdrawals_export_${Date.now()}.csv`
            });

        } catch (error) {
            console.error('❌ Withdrawals export error:', error);
            await bot.sendMessage(chatId, '❌ Error generating withdrawals export.');
        }
    },

    // Export statistics report
    async exportStatistics(chatId) {
        try {
            const [allUsers, verifiedUsers, pendingPayments, pendingWithdrawals, topReferrers] = await Promise.all([
                UserService.getAllUsers(),
                UserService.getVerifiedUsers(),
                PaymentService.getPendingPayments(),
                WithdrawalService.getPendingWithdrawals(),
                UserService.getTopReferrers(10)
            ]);

            const userCount = Object.keys(allUsers).length;
            const verifiedCount = verifiedUsers.length;
            const totalRevenue = verifiedCount * 500; // Assuming 500 registration fee
            const totalWithdrawals = Object.values(allUsers).reduce((sum, user) => sum + (user.rewards || 0), 0);

            const statsReport = 
                `📈 *BOT STATISTICS REPORT*\n\n` +
                `📅 Generated: ${new Date().toLocaleString()}\n\n` +
                `👥 *USER STATISTICS*\n` +
                `• Total Users: ${userCount}\n` +
                `• Verified Users: ${verifiedCount}\n` +
                `• Pending Verification: ${userCount - verifiedCount}\n` +
                `• Verification Rate: ${((verifiedCount / userCount) * 100).toFixed(1)}%\n\n` +
                `💰 *FINANCIAL STATISTICS*\n` +
                `• Total Revenue: ${formatCurrency(totalRevenue)}\n` +
                `• Pending Payments: ${pendingPayments.length}\n` +
                `• Pending Withdrawals: ${pendingWithdrawals.length}\n` +
                `• Total Rewards Distributed: ${formatCurrency(totalWithdrawals)}\n\n` +
                `🏆 *TOP REFERRERS*\n`;

            topReferrers.forEach((user, index) => {
                statsReport += `${index + 1}. ${user.name || 'Unknown'}: ${user.referralCount || 0} referrals\n`;
            });

            const buffer = Buffer.from(statsReport, 'utf-8');

            await bot.sendDocument(chatId, buffer, {
                caption: `📊 *Statistics Report*\n\nComprehensive bot analytics`,
                parse_mode: 'Markdown',
                filename: `statistics_report_${Date.now()}.txt`
            });

        } catch (error) {
            console.error('❌ Statistics export error:', error);
            await bot.sendMessage(chatId, '❌ Error generating statistics report.');
        }
    },

    // Helper function to get all payments
    async getAllPayments() {
        // This would need to be implemented in PaymentService
        // For now, return pending payments as example
        return await PaymentService.getPendingPayments();
    },

    // Helper function to get all withdrawals
    async getAllWithdrawals() {
        // This would need to be implemented in WithdrawalService  
        // For now, return pending withdrawals as example
        return await WithdrawalService.getPendingWithdrawals();
    },

    // Handle export callbacks
    async handleExportCallback(callbackQuery) {
        const data = callbackQuery.data;

        if (data.startsWith('export_')) {
            await this.handleExportType(callbackQuery);
            return true;
        }

        return false;
    }
};

module.exports = ExportHandler;
