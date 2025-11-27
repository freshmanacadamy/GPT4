const bot = require('../config/bot');
const { getUser, setUser, getTopReferrers, getAllUsers } = require('../database/users');
const { BOT_USERNAME, REFERRAL_REWARD, MIN_REFERRALS_FOR_WITHDRAW } = require('../config/environment');
const { formatCurrency, checkFeatureStatus } = require('../utils/helpers');

// --- Handle /start with referral link parameter ---
const handleReferralStart = async (msg) => {
    try {
        const userId = msg.from.id;
        const text = msg.text;
        
        // Check if referral system is active
        const feature = checkFeatureStatus('referral');
        if (!feature.allowed) { return null; }

        if (text?.startsWith('/start ref_')) {
            const referrerId = parseInt(text.split('ref_')[1].trim());
            const user = await getUser(userId);
            
            // 1. Check if user already exists and has a referrer
            if (user?.referrerId) { return user.referrerId; }
            
            // 2. Prevent self-referral and check for valid referrer
            if (userId === referrerId) { return null; }
            
            const referrer = await getUser(referrerId);
            const newUser = user || { telegramId: userId }; 

            if (referrer) {
                // If the user is new or doesn't have a referrer, link them
                newUser.referrerId = referrerId.toString();
                await setUser(userId, newUser);
                
                // Note: Referral count/reward is only updated *after* the new user's payment is verified (in admin.js)
                console.log(`✅ Referral link recorded: User ${userId} referred by ${referrerId}`);
                return referrerId;
            } else {
                console.log(`❌ Referrer ID ${referrerId} not found.`);
            }
        }
        return null;
        
    } catch (error) {
        console.error('❌ Error in handleReferralStart:', error);
        return null;
    }
};


// --- Invite & Earn Button Handler ---
const handleInviteEarn = async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await getUser(userId);
    
    const feature = checkFeatureStatus('referral');
    if (!feature.allowed) {
        await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
        return;
    }

    if (!user?.isVerified) {
        await bot.sendMessage(chatId, '❌ *Access Denied.* You must be a verified student to use the referral system.', { parse_mode: 'Markdown' });
        return;
    }
    
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
    const minWithdrawal = MIN_REFERRALS_FOR_WITHDRAW * REFERRAL_REWARD;
    const canWithdraw = (user.rewards || 0) >= minWithdrawal;

    const inviteMessage = 
        `🎁 *INVITE & EARN*\\n\\n` +
        `🔗 *Your Referral Link:*\\n` +
        `\\`${referralLink}\\`\\n\\n` +
        `*Share this link to earn!*\\n\\n` +
        `📊 *Your Stats:*\\n` +
        `• Referrals: ${user.referralCount || 0}\\n` +
        `• Rewards: ${formatCurrency(user.rewards || 0)}\\n` +
        `• Reward per referral: ${formatCurrency(REFERRAL_REWARD)}\\n` +
        `• Min Withdrawal: ${MIN_REFERRALS_FOR_WITHDRAW} verified referrals (${formatCurrency(minWithdrawal)})\\n` +
        `• Can Withdraw: ${canWithdraw ? '✅ Yes' : '❌ No'}`;

    await bot.sendMessage(chatId, inviteMessage, { parse_mode: 'Markdown' });
};

// --- Leaderboard Button Handler ---
const handleLeaderboard = async (msg) => {
    const chatId = msg.chat.id;
    
    const feature = checkFeatureStatus('referral');
    if (!feature.allowed) {
        await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
        return;
    }

    const topReferrers = await getTopReferrers(10); // Fetches top 10 from DB

    let leaderboardMessage = `🏆 *TOP 10 REFERRAL LEADERBOARD*\\n\\n`;

    if (topReferrers.length === 0) {
        leaderboardMessage += 'No verified referrals yet.';
    } else {
        topReferrers.forEach((user, index) => {
            const rank = index + 1;
            const name = user.name || user.firstName || `User ${user.telegramId}`;
            leaderboardMessage += `${rank}. *${name}* - ${user.referralCount || 0} Referrals (${formatCurrency(user.rewards || 0)})\\n`;
        });
    }

    await bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' });
};


module.exports = {
    handleInviteEarn,
    handleLeaderboard,
    handleReferralStart
};
