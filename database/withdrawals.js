const { db, admin } = require('../config/firebase');

const WITHDRAWALS_COLLECTION = 'withdrawals';

const WithdrawalService = {
    // Add withdrawal request
    async addWithdrawalRequest(withdrawalData) {
        try {
            const docRef = await db.collection(WITHDRAWALS_COLLECTION).add({
                ...withdrawalData,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            return docRef.id;
        } catch (error) {
            console.error('❌ Error adding withdrawal:', error);
            return null;
        }
    },

    // Get pending withdrawals
    async getPendingWithdrawals() {
        try {
            const snapshot = await db.collection(WITHDRAWALS_COLLECTION)
                .where('status', '==', 'pending')
                .orderBy('timestamp', 'desc')
                .get();
            
            const withdrawals = [];
            snapshot.forEach(doc => {
                withdrawals.push({ id: doc.id, ...doc.data() });
            });
            return withdrawals;
        } catch (error) {
            console.error('❌ Error getting pending withdrawals:', error);
            return [];
        }
    },

    // Get withdrawals by user
    async getWithdrawalsByUser(userId) {
        try {
            const snapshot = await db.collection(WITHDRAWALS_COLLECTION)
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .get();
            
            const withdrawals = [];
            snapshot.forEach(doc => {
                withdrawals.push({ id: doc.id, ...doc.data() });
            });
            return withdrawals;
        } catch (error) {
            console.error('❌ Error getting user withdrawals:', error);
            return [];
        }
    },

    // Update withdrawal status
    async updateWithdrawal(withdrawalId, updateData) {
        try {
            await db.collection(WITHDRAWALS_COLLECTION).doc(withdrawalId).set({
                ...updateData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Error updating withdrawal:', error);
            return false;
        }
    }
};

module.exports = WithdrawalService;
