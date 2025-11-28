const admin = require('firebase-admin');
const environment = require('./environment');

// Global variables to store Firebase instances
let db = null;
let storage = null;
let isInitialized = false;

const initializeFirebase = () => {
    // Return existing instances if already initialized
    if (isInitialized && db && storage) {
        return { db, storage };
    }

    try {
        console.log('🔄 Initializing Firebase...');
        
        // Validate environment variables
        const requiredEnvVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_PRIVATE_KEY', 
            'FIREBASE_CLIENT_EMAIL'
        ];
        
        const missingVars = requiredEnvVars.filter(key => !environment[key]);
        if (missingVars.length > 0) {
            throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
        }

        // Create service account configuration
        const serviceAccount = {
            type: 'service_account',
            project_id: environment.FIREBASE_PROJECT_ID,
            private_key_id: environment.FIREBASE_PRIVATE_KEY_ID,
            private_key: environment.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: environment.FIREBASE_CLIENT_EMAIL,
            client_id: environment.FIREBASE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: environment.FIREBASE_CLIENT_X509_CERT_URL
        };

        // Initialize Firebase Admin SDK only if no apps exist
        if (admin.apps.length === 0) {
            console.log('📡 Creating new Firebase app instance...');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${environment.FIREBASE_PROJECT_ID}.firebaseio.com`
            });
        } else {
            console.log('♻️ Using existing Firebase app instance...');
        }

        // Get Firestore and Storage instances
        db = admin.firestore();
        storage = admin.storage();
        isInitialized = true;

        console.log('✅ Firebase initialized successfully');
        console.log(`📊 Project: ${environment.FIREBASE_PROJECT_ID}`);
        
        return { db, storage };

    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        
        // Provide more detailed error information
        if (error.message.includes('private key')) {
            console.error('🔑 Private key format issue. Make sure FIREBASE_PRIVATE_KEY has proper newlines.');
        }
        if (error.message.includes('certificate')) {
            console.error('📜 Certificate validation failed. Check FIREBASE_CLIENT_X509_CERT_URL.');
        }
        
        throw error;
    }
};

// Test connection on startup
const testFirebaseConnection = async () => {
    try {
        const { db: testDb } = initializeFirebase();
        // Try a simple operation to test connection
        await testDb.collection('test_connection').doc('ping').set({
            timestamp: new Date(),
            status: 'connected'
        }, { merge: true });
        
        console.log('✅ Firebase connection test successful');
        return true;
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        return false;
    }
};

// Initialize Firebase immediately but handle cold starts
const initializeOnDemand = () => {
    if (!isInitialized) {
        return initializeFirebase();
    }
    return { db, storage };
};

// Get database instance with lazy initialization
const getDatabase = () => {
    if (!db) {
        const instances = initializeOnDemand();
        return instances.db;
    }
    return db;
};

// Get storage instance with lazy initialization  
const getStorage = () => {
    if (!storage) {
        const instances = initializeOnDemand();
        return instances.storage;
    }
    return storage;
};

// Health check function
const checkFirebaseHealth = async () => {
    try {
        const database = getDatabase();
        await database.collection('health_check').doc('status').get();
        return {
            status: 'connected',
            database: 'online',
            storage: storage ? 'online' : 'disabled',
            projectId: environment.FIREBASE_PROJECT_ID
        };
    } catch (error) {
        return {
            status: 'disconnected',
            database: 'offline',
            storage: 'offline',
            error: error.message
        };
    }
};

// Initialize on module load (for serverless cold starts)
console.log('🚀 Loading Firebase configuration...');
const firebaseInstances = initializeFirebase();

// Export instances and utilities
module.exports = {
    // Main instances
    db: firebaseInstances.db,
    storage: firebaseInstances.storage,
    admin,
    
    // Utility functions
    getDatabase,
    getStorage,
    checkFirebaseHealth,
    testFirebaseConnection,
    initializeFirebase,
    
    // Status
    isInitialized: () => isInitialized
};
