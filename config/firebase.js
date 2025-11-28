const admin = require('firebase-admin');
const environment = require('./environment');

// Remove these global variables - THEY CAUSE THE ERROR
// let db = null;
// let storage = null;

const initializeFirebase = () => {
    try {
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

        // Validate required environment variables
        const requiredVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
        const missingVars = requiredVars.filter(key => !environment[key]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
        }

        // Initialize only if no apps exist
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${environment.FIREBASE_PROJECT_ID}.firebaseio.com`
            });
        }

        const db = admin.firestore();
        const storage = admin.storage();
        
        console.log('✅ Firebase initialized successfully');
        return { db, storage };
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        throw error;
    }
};

// ✅ FIX: Simple initialization without destructuring
const firebase = initializeFirebase();

module.exports = {
    db: firebase.db,
    storage: firebase.storage,
    admin
};
