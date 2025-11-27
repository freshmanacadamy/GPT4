const bot = require('../config/bot');
const { getAllTrialMaterials, getTrialMaterialById } = require('../database/tutorials'); 
const { checkFeatureStatus } = require('../utils/helpers');

const handleTrialMaterials = async (msg) => {
    const chatId = msg.chat.id;

    const feature = checkFeatureStatus('trial'); 
    if (!feature.allowed) {
        await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
        return;
    }

    const materials = await getAllTrialMaterials();

    let message = '📚 *FREE TRIAL MATERIALS*\\n\\n';
    
    if (materials.length === 0) {
        message += 'No free trial materials are currently available.';
    } else {
        message += 'Select a material below:\\n\\n';

        const inline_keyboard = materials.map(m => ([
            { text: `[${m.type.toUpperCase()}] ${m.title}`, callback_data: `trial_view_${m.id}` }
        ]));
        
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inline_keyboard
            }
        });
    }
};

const handleViewTrialMaterial = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const materialId = callbackQuery.data.split('_')[2];

    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Fetching material...' });

    const material = await getTrialMaterialById(materialId);
    
    if (!material) {
        await bot.sendMessage(chatId, '❌ Material not found.', { parse_mode: 'Markdown' });
        return;
    }

    const caption = `📘 *${material.title}*\\n\\n_This is a free trial material._`;

    // Send the appropriate file type
    if (material.fileId && (material.type === 'pdf' || material.type === 'document')) {
        await bot.sendDocument(chatId, material.fileId, { caption: caption, parse_mode: 'Markdown' });
    } else if (material.type === 'text') {
        await bot.sendMessage(chatId, `${caption}\\n\\n---\\n\\n${material.content}`, { parse_mode: 'Markdown' });
    } else {
        await bot.sendMessage(chatId, '❌ Material content is unavailable or unsupported.', { parse_mode: 'Markdown' });
    }
};

module.exports = {
    handleTrialMaterials,
    handleViewTrialMaterial
};
