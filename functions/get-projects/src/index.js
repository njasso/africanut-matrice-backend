// functions/get-projects/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-projects");

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
    
    // Récupération des projets
    const projects = await db.collection('projects').find({}, {
      projection: {
        name: 1, title: 1, description: 1, status: 1, members: 1, 
        organization: 1, tags: 1, createdAt: 1, updatedAt: 1,
        budget: 1, progress: 1, startDate: 1, endDate: 1,
        importedFromMember: 1, memberSource: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${projects.length} projets récupérés`);

    // Formatage des projets
    const formattedProjects = projects.map(project => ({
      _id: project._id?.toString(),
      name: project.name || project.title || '',
      title: project.title || project.name || '',
      description: project.description || '',
      status: project.status || 'active',
      members: Array.isArray(project.members) ? project.members : [],
      organization: project.organization || '',
      tags: Array.isArray(project.tags) ? project.tags : [],
      budget: project.budget || 0,
      progress: project.progress || 0,
      startDate: project.startDate,
      endDate: project.endDate,
      importedFromMember: project.importedFromMember || false,
      memberSource: project.memberSource || '',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedProjects, // ← Tableau direct
      total: formattedProjects.length,
      message: `${formattedProjects.length} projets chargés avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-projects: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des projets",
      error: err.message
    });
  }
}

export default handler;
