const { getBot } = require('../config/bot');
const bot = getBot();
const TutorialService = require('../database/tutorials');
const { checkFeatureStatus } = require('../utils/helpers');

// Admin state for trial management
const adminTrialState = new Map();

const TrialHandler = {
    // Handle free trial button (User)
    async handleTrialMaterials(msg) {
        const chatId = msg.chat.id;

        try {
            // Check feature status
            const feature = checkFeatureStatus('trial');
            if (!feature.allowed) {
                await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
                return;
            }

            const folders = await TutorialService.getAllFolders();

            if (folders.length === 0) {
                await bot.sendMessage(chatId, 
                    "📚 *FREE TRIAL MATERIALS*\n\n" +
                    "No trial materials available yet.\n\n" +
                    "Check back later for educational content!",
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            let message = "📚 *FREE TRIAL MATERIALS*\n\n";
            message += "Select a category to browse materials:\n\n";

            // Create inline keyboard with folders
            const inline_keyboard = folders.map(folder => [
                { 
                    text: `${folder.icon || '📁'} ${folder.name} (${folder.itemCount || 0})`, 
                    callback_data: `trial_folder_${folder.id}` 
                }
            ]);

            // Add admin button if user is admin
            const user = msg.from;
            const { ADMIN_IDS } = require('../config/environment');
            if (ADMIN_IDS.includes(user.id)) {
                inline_keyboard.push([
                    { text: '👑 Manage Trial Content', callback_data: 'trial_admin_panel' }
                ]);
            }

            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard }
            });

        } catch (error) {
            console.error('❌ Trial materials error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle folder selection
    async handleFolderSelection(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const folderId = callbackQuery.data.split('_')[2];

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading materials...' });

            const [folder, materials] = await Promise.all([
                TutorialService.getFolder(folderId),
                TutorialService.getMaterialsByFolder(folderId)
            ]);

            if (!folder) {
                await bot.sendMessage(chatId, '❌ Folder not found.', { parse_mode: 'Markdown' });
                return;
            }

            let message = `📁 *${folder.name}*\n\n`;
            
            if (materials.length === 0) {
                message += "No materials available in this category yet.\n\nCheck back later!";
            } else {
                message += `Available materials (${materials.length}):\n\n`;
            }

            // Create materials list
            const inline_keyboard = materials.map(material => [
                { 
                    text: `${this.getMaterialIcon(material.type)} ${material.title}`, 
                    callback_data: `trial_material_${material.id}` 
                }
            ]);

            // Add back button
            inline_keyboard.push([
                { text: '🔙 Back to Categories', callback_data: 'trial_categories' }
            ]);

            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard }
            });

        } catch (error) {
            console.error('❌ Folder selection error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error loading folder' });
        }
    },

    // Handle material viewing
    async handleViewMaterial(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const materialId = callbackQuery.data.split('_')[2];

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading material...' });

            const material = await TutorialService.getMaterial(materialId);
            
            if (!material) {
                await bot.sendMessage(chatId, '❌ Material not found.', { parse_mode: 'Markdown' });
                return;
            }

            const caption = `📘 *${material.title}*\n\n${material.description || '_No description provided._'}\n\n_This is a free trial material._`;

            // Send appropriate content based on type
            if (material.type === 'document' && material.fileId) {
                await bot.sendDocument(chatId, material.fileId, { 
                    caption: caption, 
                    parse_mode: 'Markdown' 
                });
            } else if (material.type === 'photo' && material.fileId) {
                await bot.sendPhoto(chatId, material.fileId, { 
                    caption: caption, 
                    parse_mode: 'Markdown' 
                });
            } else if (material.type === 'text' && material.content) {
                await bot.sendMessage(chatId, 
                    `${caption}\n\n---\n\n${material.content}`, 
                    { parse_mode: 'Markdown' }
                );
            } else {
                await bot.sendMessage(chatId, 
                    '❌ Material content is unavailable or unsupported.', 
                    { parse_mode: 'Markdown' }
                );
            }

        } catch (error) {
            console.error('❌ View material error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error loading material' });
        }
    },

    // Admin Trial Management
    async handleAdminTrialPanel(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading admin panel...' });

            const { ADMIN_IDS } = require('../config/environment');
            if (!ADMIN_IDS.includes(userId)) {
                await bot.sendMessage(chatId, '❌ Access denied.', { parse_mode: 'Markdown' });
                return;
            }

            const stats = await TutorialService.getTrialStats();

            const message = 
                "👑 *TRIAL CONTENT ADMIN*\n\n" +
                `📊 Statistics:\n` +
                `• Folders: ${stats.totalFolders}\n` +
                `• Materials: ${stats.totalMaterials}\n\n` +
                "Manage your trial content:";

            const inline_keyboard = [
                [{ text: '📁 Create New Folder', callback_data: 'trial_admin_create_folder' }],
                [{ text: '📄 Add New Material', callback_data: 'trial_admin_add_material' }],
                [{ text: '👁️ View All Content', callback_data: 'trial_admin_view_all' }],
                [{ text: '🔙 Back to Categories', callback_data: 'trial_categories' }]
            ];

            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard }
            });

        } catch (error) {
            console.error('❌ Admin trial panel error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error loading admin panel' });
        }
    },

    // Handle create folder start
    async handleCreateFolderStart(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;

        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Starting folder creation...' });

            adminTrialState.set(userId, { action: 'creating_folder', step: 'awaiting_name' });

            await bot.sendMessage(chatId,
                "📁 *CREATE NEW FOLDER*\n\n" +
                "Step 1: Enter the folder name:",
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            console.error('❌ Create folder start error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error starting folder creation' });
        }
    },

    // Handle folder name input
    async handleFolderNameInput(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const folderName = msg.text?.trim();

        try {
            const state = adminTrialState.get(userId);
            if (!state || state.action !== 'creating_folder' || state.step !== 'awaiting_name') return;

            if (!folderName || folderName.length < 2) {
                await bot.sendMessage(chatId, '❌ Invalid folder name. Please enter a name (min 2 characters).', { parse_mode: 'Markdown' });
                return;
            }

            state.step = 'awaiting_icon';
            state.data = { name: folderName };
            adminTrialState.set(userId, state);

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📚 Books', callback_data: 'folder_icon_📚' }],
                        [{ text: '🧮 Math', callback_data: 'folder_icon_🧮' }],
                        [{ text: '🔬 Science', callback_data: 'folder_icon_🔬' }],
                        [{ text: '💻 Tech', callback_data: 'folder_icon_💻' }],
                        [{ text: '🎓 Education', callback_data: 'folder_icon_🎓' }],
                        [{ text: '📁 Folder', callback_data: 'folder_icon_📁' }]
                    ]
                }
            };

            await bot.sendMessage(chatId,
                `✅ Name: *${folderName}*\n\n` +
                "Step 2: Select a folder icon:",
                options
            );

        } catch (error) {
            console.error('❌ Folder name input error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle folder icon selection
    async handleFolderIconSelection(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;
        const icon = callbackQuery.data.split('_')[2];

        try {
            const state = adminTrialState.get(userId);
            if (!state || state.action !== 'creating_folder' || state.step !== 'awaiting_icon') return;

            const folderData = {
                name: state.data.name,
                icon: icon,
                createdBy: userId,
                description: state.data.description || ''
            };

            const folderId = await TutorialService.createFolder(folderData);

            if (folderId) {
                adminTrialState.delete(userId);
                
                await bot.editMessageText(
                    `🎉 *FOLDER CREATED SUCCESSFULLY!*\n\n` +
                    `📁 ${icon} ${folderData.name}\n\n` +
                    `You can now add materials to this folder.`,
                    {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id,
                        parse_mode: 'Markdown'
                    }
                );
            } else {
                await bot.sendMessage(chatId, '❌ Failed to create folder. Please try again.');
            }

        } catch (error) {
            console.error('❌ Folder icon selection error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error creating folder' });
        }
    },

    // Utility function to get material icon
    getMaterialIcon(type) {
        const icons = {
            'document': '📄',
            'photo': '🖼️',
            'text': '📝',
            'video': '🎥',
            'audio': '🔊'
        };
        return icons[type] || '📎';
    },

    // Handle trial callbacks
    async handleTrialCallback(callbackQuery) {
        const data = callbackQuery.data;

        if (data === 'trial_categories') {
            await this.handleTrialMaterials({ 
                chat: { id: callbackQuery.message.chat.id }, 
                from: callbackQuery.from 
            });
            return true;
        } else if (data.startsWith('trial_folder_')) {
            await this.handleFolderSelection(callbackQuery);
            return true;
        } else if (data.startsWith('trial_material_')) {
            await this.handleViewMaterial(callbackQuery);
            return true;
        } else if (data === 'trial_admin_panel') {
            await this.handleAdminTrialPanel(callbackQuery);
            return true;
        } else if (data === 'trial_admin_create_folder') {
            await this.handleCreateFolderStart(callbackQuery);
            return true;
        } else if (data.startsWith('folder_icon_')) {
            await this.handleFolderIconSelection(callbackQuery);
            return true;
        }

        return false;
    },

    // Handle admin trial text messages
    async handleAdminTrialText(msg) {
        const userId = msg.from.id;
        const state = adminTrialState.get(userId);

        if (state && state.action === 'creating_folder' && state.step === 'awaiting_name') {
            await this.handleFolderNameInput(msg);
            return true;
        }

        return false;
    }
};

module.exports = TrialHandler;
