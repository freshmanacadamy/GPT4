const admin = require('firebase-admin');
const db = require('../config/firebase');

const getUser = async (userId) => {
    try {
        const userDoc = await db.collection('users').doc(userId.toString()).get();
        return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
        return null;
    }
};

const setUser = async (userId, userData) => {
    try {
        await db.collection('users').doc(userId.toString()).set(userData, { merge: true });
    } catch (error) {
        // error handling
    }
};

const getAllUsers = async () => {
    try {
        const snapshot = await db.collection('users').get();
        const users = {};
        snapshot.forEach(doc => {
            users[doc.id] = doc.data();
        });
        return users;
    } catch (error) {
        return {};
    }
};

const getVerifiedUsers = async () => {
    try {
        const snapshot = await db.collection('users').where('isVerified', '==', true).get();
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        return users;
    } catch (error) {
        return [];
    }
};

// NEW: For Daily Stats
const getDailyNewUsersCount = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        
        const snapshot = await db.collection('users')
            .where('joinedAt', '>=', admin.firestore.Timestamp.fromDate(today))
            .get();
            
        return snapshot.size; 
    } catch (error) {
        return 0;
    }
};

// NEW: For Admin Delete
const deleteUser = async (userId) => {
    try {
        await db.collection('users').doc(userId.toString()).delete();
        return true;
    } catch (error) {
        return false;
    }
};

const getTopReferrers = async (limit = 10) => {
    try {
        const snapshot = await db.collection('users').orderBy('referralCount', 'desc').limit(limit).get();
        const topReferrers = [];
        snapshot.forEach(doc => {
            topReferrers.push({ id: doc.id, ...doc.data() });
        });
        return topReferrers;
    } catch (error) {
        return [];
    }
};

module.exports = {
    getUser,
    setUser,
    getAllUsers,
    getVerifiedUsers,
    getDailyNewUsersCount, 
    deleteUser,
    getTopReferrers,
    // Add other exports as needed
};
