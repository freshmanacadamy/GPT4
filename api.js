// Add at the top of api.js
// CORE UTILITIES & CONFIG
const { initializeConfig } = require('./config/environment');

// DATABASE IMPORTS (Needed for GET / health check stats)
const { getAllUsers, getVerifiedUsers } = require('./database/users');
const { getPendingPayments } = require('./database/payments');
const { getPendingWithdrawals } = require('./database/withdrawals');

// HANDLER IMPORTS (Needed for POST / Telegram webhook)
// You may need to change these imports based on where your main Telegram message router is.
// Based on the modular file structure, we assume a main handler file exists.
const { handleMessage, handleCallbackQuery } = require('./handlers/main'); 
// Your file snippet also included many other handler imports, 
// which are likely consumed by handleMessage/handleCallbackQuery:
// const { handleRegisterTutorial, handleNameInput, ... } = require('./handlers/registration');
// const { handleAdminPanel, handleAdminApprove, ... } = require('./handlers/admin');


// Initialize configuration on startup (Runs on cold start)
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
    // This part is the fix for the 405 error on /
    if (req.method === 'GET') {
        // Only respond to the root path and /api for health checks
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
                 // If the database fails, return 500 instead of 405
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
                // Route message to your main handler logic
                await handleMessage(update.message);
            } else if (update.callback_query) {
                // Route callback query to your main handler logic
                await handleCallbackQuery(update.callback_query);
            }

            // Always return 200 to Telegram quickly, acknowledging the update
            return res.status(200).json({ ok: true });
        } catch (error) {
            console.error('❌ Error processing update:', error);
            // Return 500 on internal bot error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Fall-through for all other methods/paths (e.g., PUT, DELETE, or GET on /favicon.ico)
    return res.status(405).json({ error: 'Method not allowed' });
};
