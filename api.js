// Add at the top of api.js
const { initializeConfig } = require('./config/environment');
const { getAllUsers, getVerifiedUsers } = require('./database/users');
const { getPendingPayments } = require('./database/payments');
const { getPendingWithdrawals } = require('./database/withdrawals');
const { handleMessage, handleCallbackQuery } = require('./handlers/main');

// Initialize configuration on startup
initializeConfig().then(() => {
    console.log('✅ Bot configuration initialized');
}).catch(error => {
    console.error('❌ Failed to initialize config:', error);
});

// Global error handlers
process.on('unhandledRejection', (error) => {
    console.error('🔴 Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
});


// Export the serverless function handler
module.exports = async (req, res) => {
    
    // Handle GET requests (Health Check & Stats)
    if (req.method === 'GET') {
        // Simple Health Check for the root path (/)
        if (req.url === '/' || req.url === '/api') {
            try {
                // Fetch stats for the comprehensive health check
                const allUsers = await getAllUsers();
                const verifiedUsers = await getVerifiedUsers();
                const pendingPayments = await getPendingPayments();
                const pendingWithdrawals = await getPendingWithdrawals();

                // Return a detailed 200 JSON status
                return res.status(200).json({
                    status: 'online',
                    message: 'Tutorial Registration Bot is running on Vercel!',
                    timestamp: new Date().toISOString(),
                    stats: {
                        users: Object.keys(allUsers).length,
                        verified: verifiedUsers.length,
                        pendingPayments: pendingPayments.length,
                        pendingWithdrawals: pendingWithdrawals.length,
                        referrals: Object.values(allUsers).reduce((sum, u) => sum + (u.referralCount || 0), 0)
                    }
                });
            } catch (error) {
                 // If the database fails, return 500 but not 405
                console.error('❌ Database connection failed during GET request:', error);
                return res.status(500).json({ error: 'Database connection failed' });
            }
        }
    }

    // Handle POST requests (Telegram webhook)
    if (req.method === 'POST') {
        try {
            const update = req.body;
            console.log('📨 Webhook update received');

            if (update.message) {
                await handleMessage(update.message);
            } else if (update.callback_query) {
                await handleCallbackQuery(update.callback_query);
            }

            // Always return 200 to Telegram quickly
            return res.status(200).json({ ok: true });
        } catch (error) {
            console.error('❌ Error processing update:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Fall-through for all other methods/paths
    return res.status(405).json({ error: 'Method not allowed' });
};
