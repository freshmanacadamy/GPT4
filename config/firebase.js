const admin = require('firebase-admin');

// Absolute simplest initialization
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  // Ignore errors
}

module.exports = {
  db: admin.firestore(),
  admin
};
