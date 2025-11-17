import { MongoClient } from "mongodb";

export default async function handler({ req, res, log }) {
  log("🚀 Fonction Appwrite lancée : get-matrice");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGO_DB_NAME;

  if (!MONGO_URI || !DB_NAME) {
    const msg = "❌ Variables d'environnement MongoDB manquantes !";
    log(msg);
    if (res && res.status) return res.status(500).json({ success: false, message: msg });
    return;
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    log("✅ Connecté à MongoDB Atlas");

    const db = client.db(DB_NAME);

    // Liste toutes les collections
    const collections = await db.listCollections().toArray();
    if (!collections || collections.length === 0) {
      log("⚠️ Aucune collection trouvée dans la base");
      return res.json({ success: true, data: {} });
    }

    const data = {};

    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      data[col.name] = docs;
      log(`📂 Collection "${col.name}" récupérée (${docs.length} documents)`);
    }

    await client.close();
    log("🔒 Connexion MongoDB fermée");

    return res.json({ success: true, data });

  } catch (err) {
    log("❌ Erreur dans la fonction get-matrice :", err.message);
    if (client) await client.close();
    return res.status(500).json({ success: false, error: err.message });
  }
}
