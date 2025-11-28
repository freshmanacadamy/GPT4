// ADD THESE DEBUG IMPORTS AT THE TOP
console.log('🔄 Loading handlers/main.js...');

// Main message handler - ADD DEBUG LOGGING
const handleMessage = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text || '';
    
    console.log(`💬 Message from ${userId}: "${text}"`);
    
    try {
        // Handle commands
        if (text.startsWith('/')) {
            console.log(`🔍 Detected command: ${text}`);
            // ... keep your existing command handling code
        } else {
            // Handle button clicks - ADD DEBUG LOGGING
            console.log(`🔍 Processing button: "${text}"`);
            
            switch (text) {
                case '📝 Register':
                    console.log('🎯 Calling handleRegisterTutorial...');
                    await handleRegisterTutorial(msg);
                    console.log('✅ handleRegisterTutorial completed');
                    break;
                    
                case '💰 Pay Fee':
                    console.log('🎯 Calling handlePayFee...');
                    await handlePayFee(msg);
                    console.log('✅ handlePayFee completed');
                    break;
                    
                case '🎁 Invite & Earn':
                    console.log('🎯 Calling handleInviteEarn...');
                    await handleInviteEarn(msg);
                    console.log('✅ handleInviteEarn completed');
                    break;
                    
                case '👤 My Profile':
                    console.log('🎯 Calling handleMyProfile...');
                    await handleMyProfile(msg);
                    console.log('✅ handleMyProfile completed');
                    break;
                    
                case '📚 Free Trial':
                    console.log('🎯 Calling handleTrialMaterials...');
                    await handleTrialMaterials(msg);
                    console.log('✅ handleTrialMaterials completed');
                    break;
                    
                case '📌 Rules':
                    console.log('🎯 Calling handleRules...');
                    await handleRules(msg);
                    console.log('✅ handleRules completed');
                    break;
                    
                case '❓ Help':
                    console.log('🎯 Calling handleHelp...');
                    await handleHelp(msg);
                    console.log('✅ handleHelp completed');
                    break;
                    
                default:
                    console.log('❓ Unknown button text, sending default response');
                    await bot.sendMessage(chatId, 
                        `Unknown command: "${text}"\\n\\nUse the menu buttons or /help`,
                        { parse_mode: 'Markdown' }
                    );
            }
        }
        
    } catch (error) {
        console.error('❌ ERROR in handleMessage:', error);
        console.error('Error stack:', error.stack);
        // ... keep your existing error handling
    }
};
