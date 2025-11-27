const bot = require('../config/bot');
const { getUser, setUser, getTopReferrers, getUserReferrals } = require('../database/users');
const { BOT_USERNAME, REFERRAL_REWARD, MIN_REFERRALS_FOR_WITHDRAW } = require('../config/environment');
const { checkFeatureStatus, getFirebaseTimestamp } = require('../utils/helpers');

// =================================================================================
// Handlers for Referral Features
// =================================================================================

const handleInviteEarn = async (msg) => {
    const featureStatus = checkFeatureStatus('referral');
    if (!featureStatus.allowed) {
        await bot.sendMessage(msg.chat.id, featureStatus.message, { parse_mode: 'Markdown' });
        return;
    }

    try {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        console.log('🔄 HandleInviteEarn called for user:', userId);
        
        const user = await getUser(userId);
        if (!user) {
            await bot.sendMessage(chatId, '❌ User not found. Please start the bot with /start first.');
            return;
        }
        
        const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
        const minWithdrawal = MIN_REFERRALS_FOR_WITHDRAW * REFERRAL_REWARD;
        const canWithdraw = (user.rewards || 0) >= minWithdrawal;

        // **CORRECTED BLOCK:** Using a single, clean template literal to avoid the syntax error.
        const inviteMessage = `
🎁 *INVITE & EARN*

🔗 *Your Referral Link:*
\`${referralLink}\`

📊 *Your Stats:*
• Referrals: ${user.referralCount || 0}
• Rewards: ${user.rewards || 0} ETB
• Can Withdraw: ${canWithdraw ? '✅ Yes' : '❌ No'} (Min: ${minWithdrawal} ETB for ${MIN_REFERRALS_FOR_WITHDRAW} refs)

Share your link and start earning rewards!
        `.trim();

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 My Referrals', callback_data: 'my_referrals' }],
                    [{ text: '🏆 Leaderboard', callback_data: 'leaderboard' }]
                ]
            }
        };

        await bot.sendMessage(chatId, inviteMessage, options);

    } catch (error) {
        console.error('❌ Error in handleInviteEarn:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred while generating the invite message.');
    }
};

const handleLeaderboard = async (msg) => {
    const featureStatus = checkFeatureStatus('referral');
    if (!featureStatus.allowed) {
        await bot.sendMessage(msg.chat.id, featureStatus.message, { parse_mode: 'Markdown' });
        return;
    }

    try {
        const chatId = msg.chat.id;
        const topReferrers = await getTopReferrers(10); // Get top 10

        let leaderboardMessage = '🏆 *TOP 10 REFERRERS*\\n\\n';

        if (topReferrers.length === 0) {
            leaderboardMessage += 'No referrals recorded yet.';
        } else {
            topReferrers.forEach((user, index) => {
                const name = user.name || (user.firstName || `User ${user.id}`);
                leaderboardMessage += `${index + 1}. *${name}* - ${user.referralCount || 0} Referrals\\n`;
            });
        }

        await bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('❌ Error in handleLeaderboard:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred while fetching the leaderboard.');
    }
};

const handleMyReferrals = async (msg) => {
    const featureStatus = checkFeatureStatus('referral');
    if (!featureStatus.allowed) {
        await bot.sendMessage(msg.chat.id, featureStatus.message, { parse_mode: 'Markdown' });
        return;
    }

    try {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        const referrals = await getUserReferrals(userId);

        let referralsMessage = `👤 *MY REFERRALS*\\n\\n`;

        if (referrals.length === 0) {
            referralsMessage += 'You have no successful referrals yet.';
        } else {
            referralsMessage += `Total Referrals: ${referrals.length}\\n\\n`;
            
            referrals.forEach((ref, index) => {
                const name = ref.name || (ref.firstName || `User ${ref.telegramId}`);
                const joinedDate = ref.joinedAt ? getFirebaseTimestamp(ref.joinedAt).toLocaleDateString() : 'Unknown Date';
                const status = ref.isVerified ? '✅ Verified' : '⏳ Pending';
                
                referralsMessage += `${index + 1}. ${name} - (${status}, Joined: ${joinedDate})\\n`;
            });
        }

        await bot.sendMessage(chatId, referralsMessage, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('❌ Error in handleMyReferrals:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred while fetching your referrals.');
    }
};

/**
 * Handles the logic when a user starts the bot via a referral link (/start ref_12345)
 * @param {object} msg - The Telegram message object
 * @returns {string|null} The referrerId if a referral was successfully processed, otherwise null.
 */
const handleReferralStart = async (msg) => {
    try {
        const userId = msg.from.id;
        const text = msg.text;
        
        let referrerId = null;

        // Check if the message is a /start command with a referral parameter
        if (text && text.startsWith('/start ref_')) {
            const referrerIdStr = text.substring(11); // Extract ID after '/start ref_'
            referrerId = parseInt(referrerIdStr);

            // 1. Ensure it's not a self-referral
            if (referrerId && referrerId !== userId) {
                const referrer = await getUser(referrerId);
                const newUser = await getUser(userId);

                // 2. Ensure both users exist and the new user hasn't been referred before
                if (referrer && newUser && !newUser.referrerId) {
                    
                    // The referral is recorded immediately upon /start
                    referrer.referralCount = (referrer.referralCount || 0) + 1;
                    referrer.rewards = (referrer.rewards || 0) + REFERRAL_REWARD;
                    referrer.totalRewards = (referrer.totalRewards || 0) + REFERRAL_REWARD;
                    
                    await setUser(referrerId, referrer);
                    
                    // Track who referred this user
                    newUser.referrerId = referrerId.toString();
                    await setUser(userId, newUser);
                    
                    console.log(`✅ Referral recorded: User ${userId} referred by ${referrerId}`);
                    console.log(`💰 Referrer ${referrerId} now has: ${referrer.referralCount} referrals, ${referrer.rewards} ETB`);
                } else {
                    console.log('❌ Referrer not found, new user already referred, or new user is null.');
                }
            } else {
                console.log('❌ Self-referral detected or referrer ID is invalid, skipping');
            }
        } else {
            console.log('❌ No referral parameter found in start message');
        }
        
        return referrerId;
        
    } catch (error) {
        console.error('❌ Error in handleReferralStart:', error);
        return null;
    }
};

module.exports = {
    handleInviteEarn,
    handleLeaderboard,
    handleMyReferrals,
    handleReferralStart
};
