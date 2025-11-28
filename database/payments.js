const { db, admin } = require('../config/firebase');

const PAYMENTS_COLLECTION = 'payments';

const PaymentService = {
    // Add new payment
    async addPayment(paymentData) {
        try {
            const docRef = await db.collection(PAYMENTS_COLLECTION).add({
                ...paymentData,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            return docRef.id;
        } catch (error) {
            console.error('❌ Error adding payment:', error);
            return null;
        }
    },

    // Get pending payments
    async getPendingPayments() {
        try {
            const snapshot = await db.collection(PAYMENTS_COLLECTION)
                .where('status', '==', 'pending')
                .orderBy('timestamp', 'desc')
                .get();
            
            const payments = [];
            snapshot.forEach(doc => {
                payments.push({ id: doc.id, ...doc.data() });
            });
            return payments;
        } catch (error) {
            console.error('❌ Error getting pending payments:', error);
            return [];
        }
    },

    // Get payment by ID
    async getPaymentById(paymentId) {
        try {
            const doc = await db.collection(PAYMENTS_COLLECTION).doc(paymentId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('❌ Error getting payment by ID:', error);
            return null;
        }
    },

    // Update payment
    async setPayment(paymentId, paymentData) {
        try {
            await db.collection(PAYMENTS_COLLECTION).doc(paymentId).set({
                ...paymentData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Error updating payment:', error);
            return false;
        }
    }
};

module.exports = PaymentService;
