// api.js - Main serverless function for Vercel deployment
// Complete Telegram Bot API with health checks and webhook handling

// CORE UTILITIES & CONFIG
const { initializeConfig } = require('./config/environment');

// DATABASE IMPORTS (Needed for GET / health check stats)
const { getAllUsers, getVerifiedUsers } = require('./database/users');
const { getPendingPayments } = require('./database/payments');
const { getPendingWithdrawals } = require('./database/withdrawals');

// HANDLER IMPORTS (Needed for POST / Telegram webhook)
const { handleMessage, handleCallbackQuery } = require('./handlers/main');

// Initialize configuration on startup (Runs on cold start)
let configInitialized = false;

const initializeApp = async () => {
    if (!configInitialized) {
        try {
            await initializeConfig();
            console.log('✅ Bot configuration initialized');
            configInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize config:', error);
            throw error;
        }
    }
};

// Global error handlers
process.on('unhandledRejection', (error) => {
    console.error('🔴 Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
    process.exit(1);
});

// Health check without database dependencies
const getBasicHealth = () => {
    return {
        status: 'online',
        message: 'Tutorial Registration Bot is running on Vercel!',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };
};

// Enhanced health check with database stats
const getEnhancedHealth = async () => {
    try {
        const [allUsers, verifiedUsers, pendingPayments, pendingWithdrawals] = await Promise.all([
            getAllUsers(),
            getVerifiedUsers(),
            getPendingPayments(),
            getPendingWithdrawals()
        ]);

        const userCount = Object.keys(allUsers).length;
        const verifiedCount = verifiedUsers.length;
        const pendingPaymentsCount = pendingPayments.length;
        const pendingWithdrawalsCount = pendingWithdrawals.length;
        const totalReferrals = Object.values(allUsers).reduce((sum, user) => sum + (user.referralCount || 0), 0);

        return {
            ...getBasicHealth(),
            stats: {
                users: userCount,
                verified: verifiedCount,
                pendingPayments: pendingPaymentsCount,
                pendingWithdrawals: pendingWithdrawalsCount,
                referrals: totalReferrals,
                verificationRate: userCount > 0 ? ((verifiedCount / userCount) * 100).toFixed(2) + '%' : '0%'
            },
            database: 'connected'
        };
    } catch (error) {
        console.error('❌ Database error in enhanced health check:', error);
        return {
            ...getBasicHealth(),
            database: 'disconnected',
            warning: 'Database temporarily unavailable',
            error: error.message
        };
    }
};

// Process Telegram update
const processTelegramUpdate = async (update) => {
    if (update.message) {
        await handleMessage(update.message);
    } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
    } else if (update.inline_query) {
        console.log('ℹ️ Inline query received (not implemented)');
    } else if (update.chosen_inline_result) {
        console.log('ℹ️ Chosen inline result received (not implemented)');
    } else {
        console.log('ℹ️ Unhandled update type:', Object.keys(update).filter(key => key !== 'update_id'));
    }
};

// Export the serverless function handler
module.exports = async (req, res) => {
    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Powered-By', 'Telegram-Bot-API');
    
    // Optional: Add CORS headers if needed for frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Initialize app configuration on first request
    if (!configInitialized) {
        try {
            await initializeApp();
        } catch (error) {
            return res.status(503).json({
                status: 'error',
                message: 'Service configuration failed',
                error: error.message
            });
        }
    }

    // Handle GET requests (Health Check & Stats)
    if (req.method === 'GET') {
        try {
            console.log(`🔍 GET request to: "${req.url}"`); // Debug logging

            // Root path and /api - full health check with stats
            if (req.url === '/' || req.url === '/api' || req.url === '/api/health' || req.url === '') {
                const healthData = await getEnhancedHealth();
                return res.status(200).json(healthData);
            }
            
            // Basic health check without database
            if (req.url === '/api/ping' || req.url === '/ping') {
                return res.status(200).json(getBasicHealth());
            }
            
            // Stats endpoint
            if (req.url === '/api/stats' || req.url === '/stats') {
                try {
                    const healthData = await getEnhancedHealth();
                    return res.status(200).json({
                        status: 'success',
                        data: healthData.stats,
                        timestamp: healthData.timestamp
                    });
                } catch (error) {
                    return res.status(503).json({
                        status: 'error',
                        message: 'Stats temporarily unavailable',
                        error: error.message
                    });
                }
            }

            // Return 404 for all other GET paths
            return res.status(404).json({
                status: 'error',
                message: 'Endpoint not found',
                availableEndpoints: [
                    'GET / - Full health check with stats',
                    'GET /api/health - Full health check with stats',
                    'GET /api/ping - Basic health check',
                    'GET /api/stats - Statistics only',
                    'POST / - Telegram webhook'
                ]
            });

        } catch (error) {
            console.error('❌ Unexpected error in GET handler:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error',
                error: error.message
            });
        }
    }

    // Handle POST requests (Telegram webhook)
    if (req.method === 'POST') {
        // Accept webhook on ALL paths to avoid routing issues
        try {
            const update = req.body;
            
            // Validate update format
            if (!update || typeof update !== 'object') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid update format: expected JSON object'
                });
            }

            if (!update.update_id) {
                return res.status(400).json({
                    status: 'error', 
                    message: 'Invalid Telegram update: missing update_id'
                });
            }

            console.log(`📨 Webhook update #${update.update_id} received`);
            console.log('Update type:', Object.keys(update).filter(key => key !== 'update_id'));

            // Process the update asynchronously (don't await to respond quickly to Telegram)
            processTelegramUpdate(update).catch(error => {
                console.error(`❌ Error processing update ${update.update_id}:`, error);
            });

            // Always return 200 quickly to acknowledge receipt
            return res.status(200).json({ 
                ok: true,
                update_id: update.update_id,
                message: 'Update received and processing'
            });

        } catch (error) {
            console.error('❌ Error in webhook handler:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error processing update',
                error: error.message
            });
        }
    }

    // Handle unsupported HTTP methods
    return res.status(405).json({
        status: 'error',
        message: 'Method not allowed',
        allowedMethods: ['GET', 'POST', 'OPTIONS']
    });
};

// Export utility functions for testing
module.exports.getBasicHealth = getBasicHealth;
module.exports.getEnhancedHealth = getEnhancedHealth;
module.exports.processTelegramUpdate = processTelegramUpdate;
