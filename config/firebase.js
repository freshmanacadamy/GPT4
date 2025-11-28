const admin = require('firebase-admin');
const environment = require('./environment');

// Prevent double initialization
let firebaseInstances = {
    db: null,
    storage: null,
    initialized: false
};

const initializeFirebase = () => {
    if (firebaseInstances.initialized && firebaseInstances.db && firebaseInstances.storage) {
        return firebaseInstances;
    }

    try {
        console.log("🔄 Initializing Firebase...");

        const requiredEnvVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_PRIVATE_KEY',
            'FIREBASE_PRIVATE_KEY_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_CLIENT_ID',
            'FIREBASE_CLIENT_X509_CERT_URL'
        ];

        const missing = requiredEnvVars.filter(key => !environment[key]);
        if (missing.length) {
            throw new Error(`Missing Firebase environment variables: ${missing.join(", ")}`);
        }

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

        if (admin.apps.length === 0) {
            console.log("📡 Creating Firebase app...");
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: `${environment.FIREBASE_PROJECT_ID}.appspot.com`,
                databaseURL: `https://${environment.FIREBASE_PROJECT_ID}.firebaseio.com`
            });
        } else {
            console.log("♻ Using existing Firebase app...");
        }

        firebaseInstances.db = admin.firestore();
        firebaseInstances.storage = admin.storage();
        firebaseInstances.initialized = true;

        console.log("✅ Firebase initialized");
        return firebaseInstances;

    } catch (err) {
        console.error("❌ Firebase init failed:", err);
        throw err;
    }
};

const getDatabase = () => {
    if (!firebaseInstances.db) initializeFirebase();
    return firebaseInstances.db;
};

const getStorage = () => {
    if (!firebaseInstances.storage) initializeFirebase();
    return firebaseInstances.storage;
};

const checkFirebaseHealth = async () => {
    try {
        const db = getDatabase();
        await db.collection('health_check').doc('status').get();

        return {
            status: 'connected',
            database: 'online',
            storage: firebaseInstances.storage ? 'online' : 'offline',
            projectId: environment.FIREBASE_PROJECT_ID
        };
    } catch (err) {
        return {
            status: 'disconnected',
            database: 'offline',
            storage: 'offline',
            error: err.message
        };
    }
};

// Initialize ONCE (no const redeclaration)
console.log("🚀 Loading Firebase configuration...");
initializeFirebase();

module.exports = {
    admin,
    getDatabase,
    getStorage,
    checkFirebaseHealth,
    initializeFirebase
};
