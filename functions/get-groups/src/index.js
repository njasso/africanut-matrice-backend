// functions/get-groups/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-groups");

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
    
    // Récupération des groupes
    const groups = await db.collection('groups').find({}, {
      projection: {
        name: 1, description: 1, type: 1, members: 1, projects: 1,
        createdAt: 1, updatedAt: 1, createdBy: 1, isActive: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${groups.length} groupes récupérés`);

    // Formatage des groupes
    const formattedGroups = groups.map(group => ({
      _id: group._id?.toString(),
      name: group.name || '',
      description: group.description || '',
      type: group.type || '',
      members: Array.isArray(group.members) ? group.members : [],
      projects: Array.isArray(group.projects) ? group.projects : [],
      isActive: group.isActive !== undefined ? group.isActive : true,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      createdBy: group.createdBy || ''
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedGroups, // ← Tableau direct
      total: formattedGroups.length,
      message: `${formattedGroups.length} groupes chargés avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-groups: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des groupes",
      error: err.message
    });
  }
}

export default handler;
