const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const { ADMIN_IDS } = require('../config/environment');

// Messaging state tracking
const messagingState = new Map();

const MessagingHandler = {
    // Handle broadcast command
    async handleBroadcast(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            if (!ADMIN_IDS.includes(userId)) return;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌍 Broadcast to All Users', callback_data: 'broadcast_all' }],
                        [{ text: '✅ Broadcast to Verified Only', callback_data: 'broadcast_verified' }],
                        [{ text: '⏳ Broadcast to Pending Only', callback_data: 'broadcast_pending' }],
                        [{ text: '👑 Message Admins Only', callback_data: 'broadcast_admins' }],
                        [{ text: '📨 Message Individual User', callback_data: 'message_individual' }],
                        [{ text: '🔙 Back to Admin Panel', callback_data: 'admin_back_panel' }]
                    ]
                }
            };

            await bot.sendMessage(chatId,
                "📢 *MESSAGING SYSTEM*\n\n" +
                "Choose your audience and message type:",
                options
            );

        } catch (error) {
            console.error('❌ Broadcast error:', error);
            await bot.sendMessage(chatId, '❌ Error loading messaging system.');
        }
    },

    // Handle broadcast type selection
    async handleBroadcastType(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const broadcastType = callbackQuery.data;

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Setting up broadcast...' });

            if (!ADMIN_IDS.includes(userId)) return;

            // Set messaging state
            messagingState.set(userId, {
                type: broadcastType,
                step: 'awaiting_message'
            });

            let audience = '';
            switch (broadcastType) {
                case 'broadcast_all':
                    audience = 'all users';
                    break;
                case 'broadcast_verified':
                    audience = 'verified users only';
                    break;
                case 'broadcast_pending':
                    audience = 'pending users only';
                    break;
                case 'broadcast_admins':
                    audience = 'admins only';
                    break;
                case 'message_individual':
                    audience = 'individual user';
                    messagingState.get(userId).step = 'awaiting_user_id';
                    break;
            }

            let message = `📝 *Compose Message*\n\n`;
            
            if (broadcastType === 'message_individual') {
                message += "Step 1: Send the user's Telegram ID:\n\n";
                message += "You can get user ID from student management.";
            } else {
                message += `Audience: *${audience}*\n\n`;
                message += "Please compose your message (text, photo, or document):\n\n";
                message += "*Supported formats:*\n";
                message += "• Text messages\n";
                message += "• Photos with captions\n";
                message += "• Documents with captions\n\n";
                message += "Send /cancel to abort.";
            }

            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('❌ Broadcast type error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error setting up broadcast' });
        }
    },

    // Handle user ID input for individual messages
    async handleUserIdInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const targetUserId = parseInt(msg.text);

        try {
            const state = messagingState.get(userId);
            if (!state || state.step !== 'awaiting_user_id') return;

            if (isNaN(targetUserId)) {
                await bot.sendMessage(chatId, '❌ Invalid user ID. Please enter a valid numeric ID.', { parse_mode: 'Markdown' });
                return;
            }

            // Verify user exists
            const targetUser = await UserService.getUser(targetUserId);
            if (!targetUser) {
                await bot.sendMessage(chatId, '❌ User not found. Please check the user ID.', { parse_mode: 'Markdown' });
                return;
            }

            // Update state
            state.step = 'awaiting_message';
            state.targetUserId = targetUserId;
            state.targetUserName = targetUser.name || 'Unknown';
            messagingState.set(userId, state);

            await bot.sendMessage(chatId,
                `✅ User found: *${state.targetUserName}*\n\n` +
                "Now please compose your message (text, photo, or document):\n\n" +
                "Send /cancel to abort.",
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            console.error('❌ User ID input error:', error);
            await bot.sendMessage(chatId, '❌ Error processing user ID.');
        }
    },

    // Handle message composition
    async handleMessageComposition(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            const state = messagingState.get(userId);
            if (!state || state.step !== 'awaiting_message') return;

            // Handle cancel
            if (msg.text === '/cancel') {
                messagingState.delete(userId);
                await bot.sendMessage(chatId, '✅ Message composition cancelled.', { parse_mode: 'Markdown' });
                return;
            }

            // Store message content based on type
            if (msg.text) {
                state.message = { type: 'text', content: msg.text };
            } else if (msg.photo) {
                state.message = { 
                    type: 'photo', 
                    fileId: msg.photo[msg.photo.length - 1].file_id,
                    caption: msg.caption || ''
                };
            } else if (msg.document) {
                state.message = { 
                    type: 'document', 
                    fileId: msg.document.file_id,
                    caption: msg.caption || ''
                };
            } else {
                await bot.sendMessage(chatId, '❌ Unsupported message type. Please send text, photo, or document.', { parse_mode: 'Markdown' });
                return;
            }

            state.step = 'awaiting_confirmation';
            messagingState.set(userId, state);

            // Show preview and confirmation
            await this.showMessagePreview(chatId, state);

        } catch (error) {
            console.error('❌ Message composition error:', error);
            await bot.sendMessage(chatId, '❌ Error processing message.');
        }
    },

    // Show message preview
    async showMessagePreview(chatId, state) {
        let previewMessage = "📋 *MESSAGE PREVIEW*\n\n";

        switch (state.type) {
            case 'broadcast_all':
                previewMessage += "🌍 *Audience:* All Users\n";
                break;
            case 'broadcast_verified':
                previewMessage += "✅ *Audience:* Verified Users Only\n";
                break;
            case 'broadcast_pending':
                previewMessage += "⏳ *Audience:* Pending Users Only\n";
                break;
            case 'broadcast_admins':
                previewMessage += "👑 *Audience:* Admins Only\n";
                break;
            case 'message_individual':
                previewMessage += `👤 *Audience:* ${state.targetUserName} (ID: ${state.targetUserId})\n`;
                break;
        }

        previewMessage += `\n*Message Type:* ${state.message.type.toUpperCase()}\n\n`;

        if (state.message.type === 'text') {
            previewMessage += `*Content:*\n${state.message.content}\n\n`;
        } else {
            previewMessage += `*Caption:*\n${state.message.caption || '(No caption)'}\n\n`;
        }

        previewMessage += "⚠️ *Are you sure you want to send this message?*";

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Yes, Send Now', callback_data: 'confirm_send_message' }],
                    [{ text: '❌ No, Cancel', callback_data: 'cancel_send_message' }],
                    [{ text: '✏️ Edit Message', callback_data: 'edit_message' }]
                ]
            }
        };

        await bot.sendMessage(chatId, previewMessage, options);
    },

    // Handle message confirmation
    async handleMessageConfirmation(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const action = callbackQuery.data;

        try {
            await bot.answerCallbackQuery(callbackQuery.id);

            const state = messagingState.get(userId);
            if (!state) return;

            if (action === 'cancel_send_message') {
                messagingState.delete(userId);
                await bot.editMessageText('✅ Message cancelled.', {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown'
                });
                return;
            }

            if (action === 'edit_message') {
                state.step = 'awaiting_message';
                messagingState.set(userId, state);
                
                await bot.editMessageText(
                    "✏️ *Edit Message*\n\nPlease send your updated message:",
                    {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id,
                        parse_mode: 'Markdown'
                    }
                );
                return;
            }

            if (action === 'confirm_send_message') {
                await this.sendBulkMessage(userId, chatId, state, callbackQuery.message.message_id);
            }

        } catch (error) {
            console.error('❌ Message confirmation error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing confirmation' });
        }
    },

    // Send bulk message
    async sendBulkMessage(adminId, adminChatId, state, messageId) {
        try {
            let recipients = [];
            let audienceDescription = '';

            // Get recipients based on type
            switch (state.type) {
                case 'broadcast_all':
                    const allUsers = await UserService.getAllUsers();
                    recipients = Object.keys(allUsers).map(id => parseInt(id));
                    audienceDescription = 'all users';
                    break;
                
                case 'broadcast_verified':
                    const verifiedUsers = await UserService.getVerifiedUsers();
                    recipients = verifiedUsers.map(user => user.telegramId);
                    audienceDescription = 'verified users';
                    break;
                
                case 'broadcast_pending':
                    const allUsersData = await UserService.getAllUsers();
                    recipients = Object.entries(allUsersData)
                        .filter(([_, user]) => !user.isVerified)
                        .map(([id, _]) => parseInt(id));
                    audienceDescription = 'pending users';
                    break;
                
                case 'broadcast_admins':
                    const { ADMIN_IDS } = require('../config/environment');
                    recipients = ADMIN_IDS;
                    audienceDescription = 'admins';
                    break;
                
                case 'message_individual':
                    recipients = [state.targetUserId];
                    audienceDescription = `individual user (${state.targetUserName})`;
                    break;
            }

            // Update message to show sending status
            await bot.editMessageText(
                `🔄 *Sending Messages...*\n\n` +
                `Audience: ${audienceDescription}\n` +
                `Recipients: ${recipients.length}\n` +
                `Status: Starting...`,
                {
                    chat_id: adminChatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );

            let successCount = 0;
            let failCount = 0;
            const failedUsers = [];

            // Send messages with rate limiting
            for (let i = 0; i < recipients.length; i++) {
                const recipientId = recipients[i];
                
                try {
                    if (state.message.type === 'text') {
                        await bot.sendMessage(recipientId, state.message.content, { parse_mode: 'Markdown' });
                    } else if (state.message.type === 'photo') {
                        await bot.sendPhoto(recipientId, state.message.fileId, {
                            caption: state.message.caption,
                            parse_mode: 'Markdown'
                        });
                    } else if (state.message.type === 'document') {
                        await bot.sendDocument(recipientId, state.message.fileId, {
                            caption: state.message.caption,
                            parse_mode: 'Markdown'
                        });
                    }
                    
                    successCount++;
                    
                    // Update progress every 10 messages
                    if (i % 10 === 0 || i === recipients.length - 1) {
                        await bot.editMessageText(
                            `🔄 *Sending Messages...*\n\n` +
                            `Audience: ${audienceDescription}\n` +
                            `Progress: ${i + 1}/${recipients.length}\n` +
                            `✅ Success: ${successCount}\n` +
                            `❌ Failed: ${failCount}`,
                            {
                                chat_id: adminChatId,
                                message_id: messageId,
                                parse_mode: 'Markdown'
                            }
                        );
                    }

                    // Rate limiting - wait 100ms between messages
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    failCount++;
                    failedUsers.push(recipientId);
                    console.error(`Failed to send to user ${recipientId}:`, error);
                }
            }

            // Final result
            const resultMessage = 
                `📊 *MESSAGE DELIVERY REPORT*\n\n` +
                `Audience: ${audienceDescription}\n` +
                `Total Recipients: ${recipients.length}\n` +
                `✅ Successfully Sent: ${successCount}\n` +
                `❌ Failed: ${failCount}\n` +
                `📈 Success Rate: ${((successCount / recipients.length) * 100).toFixed(1)}%`;

            await bot.editMessageText(resultMessage, {
                chat_id: adminChatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });

            // Clean up state
            messagingState.delete(adminId);

        } catch (error) {
            console.error('❌ Bulk message error:', error);
            await bot.editMessageText(
                '❌ *Error Sending Messages*\n\nAn error occurred while sending messages.',
                {
                    chat_id: adminChatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        }
    },

    // Handle messaging callbacks
    async handleMessagingCallback(callbackQuery) {
        const data = callbackQuery.data;

        if (data.startsWith('broadcast_') || data === 'message_individual') {
            await this.handleBroadcastType(callbackQuery);
            return true;
        } else if (data === 'confirm_send_message' || data === 'cancel_send_message' || data === 'edit_message') {
            await this.handleMessageConfirmation(callbackQuery);
            return true;
        }

        return false;
    },

    // Handle messaging text messages
    async handleMessagingText(msg) {
        const userId = msg.from.id;
        const state = messagingState.get(userId);

        if (!state) return false;

        if (state.step === 'awaiting_user_id') {
            await this.handleUserIdInput(msg);
            return true;
        } else if (state.step === 'awaiting_message') {
            await this.handleMessageComposition(msg);
            return true;
        }

        return false;
    }
};

module.exports = MessagingHandler;
