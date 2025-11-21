// functions/get-specialties/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-specialties");

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
    
    // Récupération des spécialités
    const specialties = await db.collection('specialties').find({}, {
      projection: {
        name: 1, category: 1, description: 1, memberCount: 1,
        createdAt: 1, updatedAt: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${specialties.length} spécialités récupérées`);

    // Formatage des spécialités
    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || '',
      description: specialty.description || '',
      memberCount: specialty.memberCount || 0,
      createdAt: specialty.createdAt,
      updatedAt: specialty.updatedAt
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedSpecialties, // ← Tableau direct
      total: formattedSpecialties.length,
      message: `${formattedSpecialties.length} spécialités chargées avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-specialties: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des spécialités",
      error: err.message
    });
  }
}

export default handler;
