// Core imports
const { initializeConfig } = require('./config/environment');
const { handleMessage, handleCallbackQuery } = require('./handlers/main');

// Global error handling
process.on('unhandledRejection', (error) => {
    console.error('🔴 Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
    process.exit(1);
});

// App state
let appInitialized = false;

const initializeApp = async () => {
    if (appInitialized) return;
    
    try {
        console.log('🔄 Initializing application...');
        
        // Initialize configuration
        await initializeConfig();
        
        console.log('✅ Application initialized successfully');
        appInitialized = true;
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        throw error;
    }
};

// Health check endpoints
const getHealthStatus = () => ({
    status: 'online',
    message: 'Tutorial Registration Bot is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
});

// Main Vercel handler
module.exports = async (req, res) => {
    // Set headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Initialize app on first request
    if (!appInitialized) {
        try {
            await initializeApp();
        } catch (error) {
            return res.status(503).json({
                status: 'error',
                message: 'Service initialization failed',
                error: error.message
            });
        }
    }

    // Handle GET requests (Health checks)
    if (req.method === 'GET') {
        const health = getHealthStatus();
        
        if (req.url === '/' || req.url === '/health') {
            return res.status(200).json(health);
        }
        
        if (req.url === '/ping') {
            return res.status(200).json({ ...health, simple: true });
        }

        return res.status(404).json({
            status: 'error',
            message: 'Endpoint not found',
            available: ['GET /', 'GET /health', 'GET /ping', 'POST /']
        });
    }

    // Handle POST requests (Telegram webhook)
    if (req.method === 'POST') {
        try {
            const update = req.body;
            
            if (!update || typeof update !== 'object') {
                return res.status(400).json({ error: 'Invalid update format' });
            }

            console.log(`📨 Update received: ${update.update_id}`);

            // Process update asynchronously
            if (update.message) {
                handleMessage(update.message).catch(console.error);
            } else if (update.callback_query) {
                handleCallbackQuery(update.callback_query).catch(console.error);
            }

            // Always respond quickly to Telegram
            return res.status(200).json({ ok: true });
        } catch (error) {
            console.error('❌ Webhook error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
};
