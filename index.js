// src/function/index.js
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log }) {
  try {
    log("🚀 Fonction Appwrite lancée : get-members");

    // Variables d'environnement pour MongoDB Atlas
    const MONGO_URI = process.env.MONGO_URI;           // Exemple: mongodb+srv://user:pass@cluster0.mongodb.net
    const DB_NAME = process.env.MONGO_DB_NAME;        // Nom de la base de données
    const COLLECTION = process.env.MONGO_COLLECTION;  // Nom de la collection

    if (!MONGO_URI || !DB_NAME || !COLLECTION) {
      throw new Error("Variables d'environnement MongoDB manquantes !");
    }

    // Connexion à MongoDB Atlas
    const client = new MongoClient(MONGO_URI, { 
      useNewUrlParser: true,
      useUnifiedTopology: true 
    });
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION);

    // Récupération des membres
    const members = await collection.find({}).toArray();

    // Envoi de la réponse JSON
    if (res && res.json) {
      res.json({ success: true, data: members });
    } else {
      log({ success: true, data: members });
    }

    await client.close();
  } catch (err) {
    log("❌ Erreur dans la fonction Appwrite :", err.message);
    if (res && res.status) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
