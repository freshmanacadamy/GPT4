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

        // Validate required environment variables
        const requiredEnvVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_PRIVATE_KEY',
            'FIREBASE_PRIVATE_KEY_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_CLIENT_ID',
            'FIREBASE_CLIENT_X509_CERT_URL'
        ];

        const missingVars = requiredEnvVars.filter(key => !environment[key]);
        if (missingVars.length > 0) {
            throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
        }

        // Create service account config
        const serviceAccount = {
            type: 'service_account',
            project_id: environment.FIREBASE_PROJECT_ID,
            private_key_id: environment.FIREBASE_PRIVATE_KEY_ID,
            private_key: environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: environment.FIREBASE_CLIENT_EMAIL,
            client_id: environment.FIREBASE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: environment.FIREBASE_CLIENT_X509_CERT_URL
        };

        // Initialize Firebase only once
        if (admin.apps.length === 0) {
            console.log('📡 Creating new Firebase app instance...');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: `${environment.FIREBASE_PROJECT_ID}.appspot.com`,
                databaseURL: `https://${environment.FIREBASE_PROJECT_ID}.firebaseio.com`
            });
        } else {
            console.log('♻️ Using existing Firebase app instance...');
        }

        db = admin.firestore();
        storage = admin.storage();
        isInitialized = true;

        console.log('✅ Firebase initialized successfully');
        return { db, storage };

    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);

        if (error.message.includes('private key')) {
            console.error('🔑 Firebase private key formatting error.');
        }

        throw error;
    }
};

// Test connection on startup
const testFirebaseConnection = async () => {
    try {
        const { db: testDb } = initializeFirebase();

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

// On-demand initialization
const initializeOnDemand = () => {
    if (!isInitialized) {
        return initializeFirebase();
    }
    return { db, storage };
};

// Get database instance
const getDatabase = () => {
    if (!db) {
        return initializeOnDemand().db;
    }
    return db;
};

// Get storage instance
const getStorage = () => {
    if (!storage) {
        return initializeOnDemand().storage;
    }
    return storage;
};

// Health check
const checkFirebaseHealth = async () => {
    try {
        const database = getDatabase();
        await database.collection('health_check').doc('status').get();

        return {
            status: 'connected',
            database: 'online',
            storage: storage ? 'online' : 'offline',
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

// Immediately initialize on load
console.log('🚀 Loading Firebase configuration...');
const firebaseInstances = initializeFirebase();

// Export modules
module.exports = {
    db: firebaseInstances.db,
    storage: firebaseInstances.storage,
    admin,

    getDatabase,
    getStorage,
    checkFirebaseHealth,
    testFirebaseConnection,
    initializeFirebase,

    isInitialized: () => isInitialized
};
