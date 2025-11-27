const bot = require('../config/bot');
const { getUser, deleteUser, setUser } = require('../database/users');
const { ADMIN_IDS } = require('../config/environment');
const { getFirebaseTimestamp, formatCurrency } = require('../utils/helpers');

class StudentManagement {
    
    // Main dashboard for student management (similar to admin.js)
    static async showStudentManagement(msg) {
        // ... (Dashboard implementation using quick stats)
    }
    
    // NEW: Handles viewing a student's full data (Admin feature)
    static async handleAdminUserDetails(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const adminId = callbackQuery.from.id;
        const targetId = callbackQuery.data.split('_')[3]; 

        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Fetching user details...' });

        if (!ADMIN_IDS.includes(adminId)) { return; }

        const user = await getUser(targetId);
        // ... (Error handling and detailed message construction) ...

        const message = `👤 *STUDENT DETAIL REPORT*...`; // Full report text

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🗑️ Delete Student Data', callback_data: `students_delete_${targetId}` },
                    { text: '🔙 Back to Management', callback_data: 'students_back_to_main' }
                ]
            ]
        };

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    // NEW: Handles permanent deletion of student data (Admin feature)
    static async handleDeleteUser(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const targetId = callbackQuery.data.split('_')[2]; 
        await bot.answerCallbackQuery(callbackQuery.id, { text: `Deleting user ${targetId}...` });

        const isDeleted = await deleteUser(targetId);

        if (isDeleted) {
            await bot.editMessageText(
                `✅ *SUCCESS!* Student with ID *${targetId}* has been permanently *DELETED*.`, 
                { chat_id: chatId, message_id: callbackQuery.message.message_id, parse_mode: 'Markdown' }
            );
        } else {
            await bot.sendMessage(chatId, `❌ Failed to delete student *${targetId}*.`, { parse_mode: 'Markdown' });
        }
    }
    
    // ... (Other functions like handleBlockUnblock, showDetailedReferrals)
}

module.exports = StudentManagement;
