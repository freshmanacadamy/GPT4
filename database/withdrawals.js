const admin = require('firebase-admin');
const db = require('../config/firebase');

const addWithdrawalRequest = async (withdrawalData) => {
    try {
        const docRef = await db.collection('withdrawals').add({
            ...withdrawalData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        return null;
    }
};

const getPendingWithdrawals = async () => {
    try {
        const snapshot = await db.collection('withdrawals').where('status', '==', 'pending').get();
        const withdrawals = [];
        snapshot.forEach(doc => {
            withdrawals.push({ id: doc.id, ...doc.data() });
        });
        return withdrawals;
    } catch (error) {
        return [];
    }
};

module.exports = {
    addWithdrawalRequest,
    getPendingWithdrawals
};
