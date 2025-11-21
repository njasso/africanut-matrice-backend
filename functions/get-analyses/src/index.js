// functions/get-analyses/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-analyses");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    return res.json({ 
      success: false, 
      message: "❌ Variable MONGODB_URI manquante !"
    });
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: MONGO_TIMEOUT_MS,
      connectTimeoutMS: MONGO_TIMEOUT_MS,
      socketTimeoutMS: MONGO_TIMEOUT_MS
    });

    log("🔌 Connexion à MongoDB...");
    await client.connect();

    const db = client.db(DB_NAME);
    
    // Récupération des analyses
    const analyses = await db.collection('analyses').find({}, {
      projection: {
        name: 1, title: 1, description: 1, type: 1, data: 1,
        createdAt: 1, updatedAt: 1, createdBy: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${analyses.length} analyses récupérées`);

    // Formatage des analyses
    const formattedAnalyses = analyses.map(analysis => ({
      _id: analysis._id?.toString(),
      name: analysis.name || '',
      title: analysis.title || '',
      description: analysis.description || '',
      type: analysis.type || '',
      data: analysis.data || {},
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
      createdBy: analysis.createdBy || ''
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedAnalyses, // ← Tableau direct
      total: formattedAnalyses.length,
      message: `${formattedAnalyses.length} analyses chargées avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-analyses: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des analyses",
      error: err.message
    });
  }
}

export default handler;
