import { MongoClient } from "mongodb";

export default async function handler({ req, res, log }) {
  try {
    log("🚀 Fonction Appwrite lancée : get-matrice");

    const MONGO_URI = process.env.MONGO_URI;
    const DB_NAME = process.env.MONGO_DB_NAME;

    if (!MONGO_URI || !DB_NAME) {
      throw new Error("Variables d'environnement MongoDB manquantes !");
    }

    const client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db(DB_NAME);

    // Liste toutes les collections
    const collections = await db.listCollections().toArray();

    const data = {};

    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      data[col.name] = docs;
      log(`📂 Collection "${col.name}" récupérée (${docs.length} documents)`);
    }

    await client.close();

    // Retourne les données JSON à Appwrite
    if (res && res.json) {
      return res.json({ success: true, data });
    } else {
      log({ success: true, data });
      return context.res.empty();
    }
  } catch (err) {
    log("❌ Erreur dans la fonction Appwrite :", err.message);
    if (res && res.status) {
      return res.status(500).json({ success: false, error: err.message });
    } else {
      return context.res.empty();
    }
  }
}
