const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (e) {
  console.log('Firebase already initialized');
}

module.exports = {
  db: admin.firestore(),
  admin
};
