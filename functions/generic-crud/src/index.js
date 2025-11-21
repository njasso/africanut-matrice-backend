// functions/generic-crud/src/index.js (POST, PUT, DELETE, GET by ID)

import { MongoClient, ObjectId } from "mongodb";

const ALLOWED_COLLECTIONS = [
    'members', 
    'projects', 
    'groups', 
    'skills', 
    'specialties', 
    'interactions'
];

export default async function handler({ req, res, log, error }) {
    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

    if (!MONGO_URI) { return res.json({ success: false, message: "MONGODB_URI manquant" }); }

    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);

        // 🎯 DÉTERMINATION DE LA COLLECTION CIBLE ET DE L'ID
        const { method, path, body } = req;
        const pathSegments = path.split('/').filter(s => s.length > 0); 
        const collectionName = pathSegments[0]; // ex: 'members'
        const id = pathSegments[1];             // ex: '691...c9'
        
        if (!collectionName || !ALLOWED_COLLECTIONS.includes(collectionName)) {
            return res.json({ success: false, message: "Collection cible non valide ou non autorisée." });
        }
        
        const collection = db.collection(collectionName);
        const data = JSON.parse(body || '{}');
        
        log(`Opération générique sur '${collectionName}': METHODE=${method}, ID=${id || 'N/A'}`);

        // 1. POST (Création)
        if (method === 'POST') {
            const document = { ...data, createdAt: new Date(), updatedAt: new Date() };
            const result = await collection.insertOne(document);
            return res.json({ 
                success: true, 
                message: `${collectionName} créé`, 
                data: { _id: result.insertedId.toString(), ...document }
            });
        }

        // 2. PUT (Mise à jour)
        if (method === 'PUT' && id) {
            const { _id, createdAt, ...updates } = data;
            try {
                const result = await collection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { ...updates, updatedAt: new Date() } }
                );
                if (result.matchedCount === 0) {
                     return res.json({ success: false, message: `${collectionName} non trouvé` });
                }
                return res.json({ success: true, message: `${collectionName} mis à jour`, modifiedCount: result.modifiedCount });
            } catch (e) {
                 if (e.message.includes('invalid id')) {
                     return res.json({ success: false, message: `ID de ${collectionName} invalide.` });
                }
                throw e;
            }
        }

        // 3. DELETE (Suppression)
        if (method === 'DELETE' && id) {
             try {
                const result = await collection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0) {
                     return res.json({ success: false, message: `${collectionName} non trouvé` });
                }
                return res.json({ success: true, message: `${collectionName} supprimé`, deletedCount: result.deletedCount });
             } catch (e) {
                if (e.message.includes('invalid id')) {
                     return res.json({ success: false, message: `ID de ${collectionName} invalide.` });
                }
                throw e;
            }
        }

        // 4. GET (Lecture unitaire)
        if (method === 'GET' && id) {
             try {
                const document = await collection.findOne({ _id: new ObjectId(id) });
                if (!document) {
                     return res.json({ success: false, message: `${collectionName} non trouvé` });
                }
                return res.json({ success: true, data: { ...document, _id: document._id.toString() } });
             } catch (e) {
                if (e.message.includes('invalid id')) {
                     return res.json({ success: false, message: `ID de ${collectionName} invalide.` });
                }
                throw e;
            }
        }
        
        return res.json({ success: false, message: `Méthode ${method} non supportée ou opération manquante.` });

    } catch (err) {
        error("❌ Erreur critique de generic-crud: " + err.message);
        return res.json({ success: false, message: "Erreur serveur CRUD générique", error: err.message });
    } finally {
        if (client) await client.close();
    }
}
