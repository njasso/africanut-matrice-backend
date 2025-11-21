// functions/analyses-crud/src/index.js (POST, PUT, DELETE)

import { MongoClient, ObjectId } from "mongodb";

export default async function handler({ req, res, log, error }) {
    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";
    
    // Pour une fonction CRUD, la méthode de la requête Appwrite est essentielle
    const { method, path, body } = req;
    
    if (!MONGO_URI) { return res.json({ success: false, message: "MONGODB_URI manquant" }); }

    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('analyses');

        const data = JSON.parse(body || '{}');
        // Extraire l'ID du path (ex: /analyses-crud/69...)
        const id = path.split('/').filter(s => s.length > 0)[1]; 
        
        log(`Opération sur 'analyses': METHODE=${method}, ID=${id || 'N/A'}`);

        // 1. POST (Création)
        if (method === 'POST') {
            if (!data.title || !data.type) {
                return res.json({ success: false, message: "Title et Type d'analyse sont requis." });
            }
            const document = {
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await collection.insertOne(document);
            return res.json({
                success: true,
                message: "Analyse créée avec succès",
                data: { _id: result.insertedId.toString(), ...document }
            });
        }

        // 2. PUT (Mise à jour)
        if (method === 'PUT' && id) {
            const { _id, createdAt, ...updates } = data; // Retirer _id et createdAt
            try {
                 const result = await collection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { ...updates, updatedAt: new Date() } }
                );
                if (result.matchedCount === 0) {
                     return res.json({ success: false, message: "Analyse non trouvée" });
                }
                return res.json({ success: true, message: "Analyse mise à jour", modifiedCount: result.modifiedCount });
            } catch (e) {
                if (e.message.includes('invalid id')) {
                     return res.json({ success: false, message: "ID d'analyse invalide." });
                }
                throw e;
            }
        }

        // 3. DELETE (Suppression)
        if (method === 'DELETE' && id) {
            try {
                const result = await collection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0) {
                     return res.json({ success: false, message: "Analyse non trouvée" });
                }
                return res.json({ success: true, message: "Analyse supprimée", deletedCount: result.deletedCount });
            } catch (e) {
                if (e.message.includes('invalid id')) {
                     return res.json({ success: false, message: "ID d'analyse invalide." });
                }
                throw e;
            }
        }
        
        // 4. GET (Lecture unitaire - OPTIONNEL)
        if (method === 'GET' && id) {
            try {
                const document = await collection.findOne({ _id: new ObjectId(id) });
                if (!document) {
                     return res.json({ success: false, message: "Analyse non trouvée" });
                }
                return res.json({ success: true, data: { ...document, _id: document._id.toString() } });
            } catch (e) {
                if (e.message.includes('invalid id')) {
                     return res.json({ success: false, message: "ID d'analyse invalide." });
                }
                throw e;
            }
        }

        return res.json({ success: false, message: `Méthode ${method} non supportée ou ID manquant.` });

    } catch (err) {
        error("❌ Erreur critique d'analyses-crud: " + err.message);
        return res.json({ success: false, message: "Erreur serveur CRUD analyses", error: err.message });
    } finally {
        if (client) await client.close();
    }
}
