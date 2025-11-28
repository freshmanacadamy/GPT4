const admin = require('firebase-admin');
const environment = require('./environment');

// Simple Firebase initialization without complex patterns
let firebaseInitialized = false;

const initializeFirebase = () => {
    if (firebaseInitialized) {
        return {
            db: admin.firestore(),
            storage: admin.storage()
        };
    }

    try {
        console.log('🔄 Initializing Firebase...');

        // Check required environment variables
        const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
        const missing = required.filter(key => !environment[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing Firebase env vars: ${missing.join(', ')}`);
        }

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

        // Initialize only if no apps exist
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        firebaseInitialized = true;
        console.log('✅ Firebase initialized successfully');

        return {
            db: admin.firestore(),
            storage: admin.storage()
        };

    } catch (error) {
        console.error('❌ Firebase init failed:', error);
        throw error;
    }
};

// Initialize immediately
const firebase = initializeFirebase();

// Export directly without complex patterns
module.exports = {
    db: firebase.db,
    storage: firebase.storage,
    admin
};
