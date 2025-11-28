// api-debug.js - Debug version to find missing files
console.log('🔧 Starting debug API...');

// Global error handlers
process.on('unhandledRejection', (error) => {
    console.error('🔴 Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
});

module.exports = async (req, res) => {
    console.log('📨 Request received:', req.method, req.url);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Test importing config files one by one
        console.log('1. Testing environment config...');
        const { initializeConfig } = require('./config/environment');
        console.log('✅ Environment config loaded');
        
        console.log('2. Testing database imports...');
        const { getAllUsers } = require('./database/users');
        console.log('✅ Database imports loaded');
        
        console.log('3. Testing handler imports...');
        const { handleMessage } = require('./handlers/main');
        console.log('✅ Handler imports loaded');
        
        console.log('🎉 All imports successful!');
        
        // Handle GET requests
        if (req.method === 'GET') {
            return res.status(200).json({
                status: 'online',
                message: 'Debug API - All imports working!',
                timestamp: new Date().toISOString()
            });
        }

        // Handle POST requests
        if (req.method === 'POST') {
            return res.status(200).json({
                ok: true,
                message: 'Debug API ready for Telegram'
            });
        }

    } catch (error) {
        console.error('❌ Import error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Import failed',
            error: error.message,
            stack: error.stack
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
