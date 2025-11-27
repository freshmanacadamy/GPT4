const admin = require('firebase-admin');
const db = require('../config/firebase');

const addPayment = async (paymentData) => {
    try {
        const docRef = await db.collection('payments').add({
            ...paymentData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        return null;
    }
};

const getPendingPayments = async () => {
    try {
        const snapshot = await db.collection('payments').where('status', '==', 'pending').get();
        const payments = [];
        snapshot.forEach(doc => {
            payments.push({ id: doc.id, ...doc.data() });
        });
        return payments;
    } catch (error) {
        return [];
    }
};

// NEW: For Admin Approval
const getPaymentById = async (paymentId) => {
    try {
        const doc = await db.collection('payments').doc(paymentId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        return null;
    }
};

const setPayment = async (paymentId, paymentData) => {
    try {
        await db.collection('payments').doc(paymentId).set(paymentData, { merge: true });
    } catch (error) {
        // error handling
    }
};

module.exports = {
    addPayment,
    getPendingPayments,
    getPaymentById,
    setPayment
};
