const { db, admin } = require('../config/firebase');

const USERS_COLLECTION = 'users';

const UserService = {
    // Get user by Telegram ID
    async getUser(userId) {
        try {
            const userDoc = await db.collection(USERS_COLLECTION).doc(userId.toString()).get();
            return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
        } catch (error) {
            console.error('❌ Error getting user:', error);
            return null;
        }
    },

    // Create or update user
    async setUser(userId, userData) {
        try {
            await db.collection(USERS_COLLECTION).doc(userId.toString()).set({
                ...userData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Error setting user:', error);
            return false;
        }
    },

    // Get all users
    async getAllUsers() {
        try {
            const snapshot = await db.collection(USERS_COLLECTION).get();
            const users = {};
            snapshot.forEach(doc => {
                users[doc.id] = doc.data();
            });
            return users;
        } catch (error) {
            console.error('❌ Error getting all users:', error);
            return {};
        }
    },

    // Get verified users
    async getVerifiedUsers() {
        try {
            const snapshot = await db.collection(USERS_COLLECTION).where('isVerified', '==', true).get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            return users;
        } catch (error) {
            console.error('❌ Error getting verified users:', error);
            return [];
        }
    },

    // Get daily new users count
    async getDailyNewUsersCount() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const snapshot = await db.collection(USERS_COLLECTION)
                .where('joinedAt', '>=', admin.firestore.Timestamp.fromDate(today))
                .get();
                
            return snapshot.size;
        } catch (error) {
            console.error('❌ Error getting daily users count:', error);
            return 0;
        }
    },

    // Delete user
    async deleteUser(userId) {
        try {
            await db.collection(USERS_COLLECTION).doc(userId.toString()).delete();
            return true;
        } catch (error) {
            console.error('❌ Error deleting user:', error);
            return false;
        }
    },

    // Get top referrers
    async getTopReferrers(limit = 10) {
        try {
            const snapshot = await db.collection(USERS_COLLECTION)
                .orderBy('referralCount', 'desc')
                .limit(limit)
                .get();
            
            const topReferrers = [];
            snapshot.forEach(doc => {
                topReferrers.push({ id: doc.id, ...doc.data() });
            });
            return topReferrers;
        } catch (error) {
            console.error('❌ Error getting top referrers:', error);
            return [];
        }
    }
};

module.exports = UserService;
