const { db, admin } = require('../config/firebase');

const FOLDERS_COLLECTION = 'trial_folders';
const MATERIALS_COLLECTION = 'trial_materials';

const TutorialService = {
    // Folder Management
    async createFolder(folderData) {
        try {
            const docRef = await db.collection(FOLDERS_COLLECTION).add({
                ...folderData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                itemCount: 0
            });
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creating folder:', error);
            return null;
        }
    },

    async getAllFolders() {
        try {
            const snapshot = await db.collection(FOLDERS_COLLECTION)
                .orderBy('createdAt', 'asc')
                .get();
            
            const folders = [];
            snapshot.forEach(doc => {
                folders.push({ id: doc.id, ...doc.data() });
            });
            return folders;
        } catch (error) {
            console.error('❌ Error getting folders:', error);
            return [];
        }
    },

    async getFolder(folderId) {
        try {
            const doc = await db.collection(FOLDERS_COLLECTION).doc(folderId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('❌ Error getting folder:', error);
            return null;
        }
    },

    async updateFolder(folderId, updateData) {
        try {
            await db.collection(FOLDERS_COLLECTION).doc(folderId).set(updateData, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Error updating folder:', error);
            return false;
        }
    },

    async deleteFolder(folderId) {
        try {
            // First delete all materials in this folder
            const materialsSnapshot = await db.collection(MATERIALS_COLLECTION)
                .where('folderId', '==', folderId)
                .get();
            
            const deletePromises = [];
            materialsSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            
            // Then delete the folder
            await db.collection(FOLDERS_COLLECTION).doc(folderId).delete();
            return true;
        } catch (error) {
            console.error('❌ Error deleting folder:', error);
            return false;
        }
    },

    // Material Management
    async addMaterial(materialData) {
        try {
            const docRef = await db.collection(MATERIALS_COLLECTION).add({
                ...materialData,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update folder item count
            if (materialData.folderId) {
                const folder = await this.getFolder(materialData.folderId);
                if (folder) {
                    await this.updateFolder(materialData.folderId, {
                        itemCount: (folder.itemCount || 0) + 1
                    });
                }
            }

            return docRef.id;
        } catch (error) {
            console.error('❌ Error adding material:', error);
            return null;
        }
    },

    async getMaterialsByFolder(folderId) {
        try {
            const snapshot = await db.collection(MATERIALS_COLLECTION)
                .where('folderId', '==', folderId)
                .orderBy('createdAt', 'asc')
                .get();
            
            const materials = [];
            snapshot.forEach(doc => {
                materials.push({ id: doc.id, ...doc.data() });
            });
            return materials;
        } catch (error) {
            console.error('❌ Error getting folder materials:', error);
            return [];
        }
    },

    async getAllMaterials() {
        try {
            const snapshot = await db.collection(MATERIALS_COLLECTION)
                .orderBy('createdAt', 'asc')
                .get();
            
            const materials = [];
            snapshot.forEach(doc => {
                materials.push({ id: doc.id, ...doc.data() });
            });
            return materials;
        } catch (error) {
            console.error('❌ Error getting all materials:', error);
            return [];
        }
    },

    async getMaterial(materialId) {
        try {
            const doc = await db.collection(MATERIALS_COLLECTION).doc(materialId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('❌ Error getting material:', error);
            return null;
        }
    },

    async updateMaterial(materialId, updateData) {
        try {
            await db.collection(MATERIALS_COLLECTION).doc(materialId).set(updateData, { merge: true });
            return true;
        } catch (error) {
            console.error('❌ Error updating material:', error);
            return false;
        }
    },

    async deleteMaterial(materialId) {
        try {
            const material = await this.getMaterial(materialId);
            if (material && material.folderId) {
                // Update folder item count
                const folder = await this.getFolder(material.folderId);
                if (folder) {
                    await this.updateFolder(material.folderId, {
                        itemCount: Math.max(0, (folder.itemCount || 0) - 1)
                    });
                }
            }

            await db.collection(MATERIALS_COLLECTION).doc(materialId).delete();
            return true;
        } catch (error) {
            console.error('❌ Error deleting material:', error);
            return false;
        }
    },

    // Statistics
    async getTrialStats() {
        try {
            const [foldersSnapshot, materialsSnapshot] = await Promise.all([
                db.collection(FOLDERS_COLLECTION).get(),
                db.collection(MATERIALS_COLLECTION).get()
            ]);

            return {
                totalFolders: foldersSnapshot.size,
                totalMaterials: materialsSnapshot.size
            };
        } catch (error) {
            console.error('❌ Error getting trial stats:', error);
            return { totalFolders: 0, totalMaterials: 0 };
        }
    }
};

module.exports = TutorialService;
