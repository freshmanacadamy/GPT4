const admin = require('firebase-admin');
const db = require('../config/firebase');

const TUTORIALS_COLLECTION = 'trial_tutorials';

const addTrialMaterial = async (materialData) => {
    try {
        const docRef = await db.collection(TUTORIALS_COLLECTION).add({
            ...materialData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        return null;
    }
};

const getAllTrialMaterials = async () => {
    try {
        const snapshot = await db.collection(TUTORIALS_COLLECTION).orderBy('timestamp', 'asc').get();
        const materials = [];
        snapshot.forEach(doc => {
            materials.push({ id: doc.id, ...doc.data() });
        });
        return materials;
    } catch (error) {
        return [];
    }
};

const deleteTrialMaterial = async (materialId) => {
    try {
        await db.collection(TUTORIALS_COLLECTION).doc(materialId).delete();
        return true;
    } catch (error) {
        return false;
    }
};

// You'd also need a getTrialMaterialById function for the view handler
const getTrialMaterialById = async (materialId) => {
    try {
        const doc = await db.collection(TUTORIALS_COLLECTION).doc(materialId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        return null;
    }
};

module.exports = {
    addTrialMaterial,
    getAllTrialMaterials,
    deleteTrialMaterial,
    getTrialMaterialById
};
