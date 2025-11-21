// functions/get-skills/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-skills");

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
    
    // Récupération des compétences
    const skills = await db.collection('skills').find({}, {
      projection: {
        name: 1, category: 1, description: 1, memberCount: 1,
        createdAt: 1, updatedAt: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${skills.length} compétences récupérées`);

    // Formatage des compétences
    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || '',
      description: skill.description || '',
      memberCount: skill.memberCount || 0,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedSkills, // ← Tableau direct
      total: formattedSkills.length,
      message: `${formattedSkills.length} compétences chargées avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-skills: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des compétences",
      error: err.message
    });
  }
}

export default handler;
