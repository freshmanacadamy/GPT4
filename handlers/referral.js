const { getBot } = require('../config/bot');
const bot = getBot();
const UserService = require('../database/users');
const { BOT_USERNAME, REFERRAL_REWARD, MIN_REFERRALS_FOR_WITHDRAW } = require('../config/environment');
const { checkFeatureStatus, formatCurrency } = require('../utils/helpers');

const ReferralHandler = {
    // Handle invite & earn button
    async handleInviteEarn(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            // Check feature status
            const feature = checkFeatureStatus('referral');
            if (!feature.allowed) {
                await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
                return;
            }

            const user = await UserService.getUser(userId);
            if (!user) {
                await bot.sendMessage(chatId, '❌ Please start the bot with /start first.', { parse_mode: 'Markdown' });
                return;
            }

            // Generate referral link
            const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
            const minWithdrawal = MIN_REFERRALS_FOR_WITHDRAW * REFERRAL_REWARD;
            const canWithdraw = (user.rewards || 0) >= minWithdrawal;

            const inviteMessage = 
                `🎁 *INVITE & EARN*\n\n` +
                `🔗 *Your Referral Link:*\n` +
                `\`${referralLink}\`\n\n` +
                `📊 *Your Stats:*\n` +
                `• Referrals: ${user.referralCount || 0}\n` +
                `• Rewards: ${formatCurrency(user.rewards || 0)}\n` +
                `• Can Withdraw: ${canWithdraw ? '✅ Yes' : '❌ No'} (Min: ${formatCurrency(minWithdrawal)} for ${MIN_REFERRALS_FOR_WITHDRAW} referrals)\n\n` +
                `💰 *Earn ${formatCurrency(REFERRAL_REWARD)} for each verified referral!*`;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👤 My Referrals', callback_data: 'referral_my_referrals' }],
                        [{ text: '🏆 Leaderboard', callback_data: 'referral_leaderboard' }]
                    ]
                }
            };

            await bot.sendMessage(chatId, inviteMessage, options);

        } catch (error) {
            console.error('❌ Invite earn error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
        }
    },

    // Handle leaderboard
    async handleLeaderboard(msg) {
        const chatId = msg.chat.id;

        try {
            // Check feature status
            const feature = checkFeatureStatus('referral');
            if (!feature.allowed) {
                await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
                return;
            }

            const topReferrers = await UserService.getTopReferrers(10);

            let leaderboardMessage = '🏆 *TOP 10 REFERRERS*\n\n';

            if (topReferrers.length === 0) {
                leaderboardMessage += 'No referrals recorded yet.';
            } else {
                topReferrers.forEach((user, index) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const medal = index < 3 ? medals[index] : `${index + 1}.`;
                    const name = user.name || user.firstName || `User ${user.id}`;
                    const rewards = formatCurrency(user.rewards || 0);
                    
                    leaderboardMessage += `${medal} *${name}*\n`;
                    leaderboardMessage += `   👥 ${user.referralCount || 0} referrals • ${rewards}\n\n`;
                });
            }

            await bot.sendMessage(chatId, leaderboardMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('❌ Leaderboard error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred while fetching leaderboard.');
        }
    },

    // Handle my referrals
    async handleMyReferrals(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            // Check feature status
            const feature = checkFeatureStatus('referral');
            if (!feature.allowed) {
                await bot.sendMessage(chatId, feature.message, { parse_mode: 'Markdown' });
                return;
            }

            // Get all users and filter by referrer
            const allUsers = await UserService.getAllUsers();
            const referrals = Object.values(allUsers).filter(user => 
                user.referrerId && user.referrerId === userId.toString()
            );

            let referralsMessage = `👤 *MY REFERRALS*\n\n`;

            if (referrals.length === 0) {
                referralsMessage += 'You have no successful referrals yet.\n\nShare your referral link to start earning!';
            } else {
                referralsMessage += `Total Referrals: ${referrals.length}\n`;
                referralsMessage += `Total Earned: ${formatCurrency(referrals.length * REFERRAL_REWARD)}\n\n`;

                referrals.forEach((ref, index) => {
                    const name = ref.name || ref.firstName || `User ${ref.telegramId}`;
                    const status = ref.isVerified ? '✅ Verified' : '⏳ Pending';
                    const date = ref.joinedAt ? new Date(ref.joinedAt.seconds * 1000).toLocaleDateString() : 'Unknown';
                    
                    referralsMessage += `${index + 1}. *${name}*\n`;
                    referralsMessage += `   ${status} • Joined: ${date}\n\n`;
                });
            }

            await bot.sendMessage(chatId, referralsMessage, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('❌ My referrals error:', error);
            await bot.sendMessage(chatId, '❌ An error occurred while fetching your referrals.');
        }
    },

    // Handle referral start (when user joins via referral link)
    async handleReferralStart(msg) {
        const userId = msg.from.id;
        const text = msg.text;

        try {
            let referrerId = null;

            // Check if it's a referral start
            if (text && text.startsWith('/start ref_')) {
                const referrerIdStr = text.substring(11);
                referrerId = parseInt(referrerIdStr);

                // Prevent self-referral and validate referrer
                if (referrerId && referrerId !== userId) {
                    const referrer = await UserService.getUser(referrerId);
                    const newUser = await UserService.getUser(userId);

                    // Only process if referrer exists and new user isn't already referred
                    if (referrer && newUser && !newUser.referrerId) {
                        
                        // Update referrer's stats
                        const newReferralCount = (referrer.referralCount || 0) + 1;
                        const newRewards = (referrer.rewards || 0) + REFERRAL_REWARD;

                        await UserService.setUser(referrerId, {
                            referralCount: newReferralCount,
                            rewards: newRewards,
                            totalRewards: (referrer.totalRewards || 0) + REFERRAL_REWARD
                        });

                        // Track who referred this user
                        await UserService.setUser(userId, {
                            referrerId: referrerId.toString()
                        });

                        console.log(`✅ Referral recorded: User ${userId} referred by ${referrerId}`);
                    }
                }
            }

            return referrerId;

        } catch (error) {
            console.error('❌ Referral start error:', error);
            return null;
        }
    },

    // Handle referral callbacks
    async handleReferralCallback(callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;

        try {
            if (data === 'referral_my_referrals') {
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading your referrals...' });
                await this.handleMyReferrals({ chat: { id: chatId }, from: { id: userId } });
                return true;
            } else if (data === 'referral_leaderboard') {
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Loading leaderboard...' });
                await this.handleLeaderboard({ chat: { id: chatId }, from: { id: userId } });
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Referral callback error:', error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error processing request' });
            return false;
        }
    }
};

module.exports = ReferralHandler;
