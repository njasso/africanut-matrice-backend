// functions/get-interactions/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-interactions");

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
    
    // Récupération des interactions
    const interactions = await db.collection('interactions').find({}, {
      projection: {
        type: 1, title: 1, description: 1, from: 1, to: 1, 
        projects: 1, status: 1, createdAt: 1, updatedAt: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${interactions.length} interactions récupérées`);

    // Formatage des interactions
    const formattedInteractions = interactions.map(interaction => ({
      _id: interaction._id?.toString(),
      type: interaction.type || '',
      title: interaction.title || '',
      description: interaction.description || '',
      from: interaction.from || '',
      to: Array.isArray(interaction.to) ? interaction.to : [],
      projects: Array.isArray(interaction.projects) ? interaction.projects : [],
      status: interaction.status || '',
      participantCount: 1 + (Array.isArray(interaction.to) ? interaction.to.length : 0),
      createdAt: interaction.createdAt,
      updatedAt: interaction.updatedAt
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedInteractions, // ← Tableau direct
      total: formattedInteractions.length,
      message: `${formattedInteractions.length} interactions chargées avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-interactions: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des interactions",
      error: err.message
    });
  }
}

export default handler;
