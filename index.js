// functions/get-matrice/src/index.js - VERSION CORRIGÉE POUR LE FRONTEND
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    const msg = "❌ Variable MONGODB_URI manquante !";
    error(msg);
    return res.json({ 
      success: false, 
      message: msg
    });
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    
    // Récupérer les membres
    const membersCollection = db.collection('members');
    const members = await membersCollection.find({}).toArray();
    
    // Récupérer les projets
    const projectsCollection = db.collection('projects');
    const projects = await projectsCollection.find({}).toArray();
    
    // Formater les données
    const formattedMembers = members.map(member => ({
      ...member,
      _id: member._id?.toString()
    }));

    const formattedProjects = projects.map(project => ({
      ...project,
      _id: project._id?.toString(),
      // Assurer que les champs requis existent
      title: project.title || "Sans titre",
      description: project.description || "",
      organization: project.organization || "",
      status: project.status || "idea",
      tags: project.tags || [],
      members: project.members || [],
      createdAt: project.createdAt || new Date()
    }));

    await client.close();
    log(`✅ ${formattedMembers.length} membres et ${formattedProjects.length} projets récupérés`);

    // ⚡ FORMAT CORRIGÉ : Retourner le format exact attendu par le frontend
    return res.json({
      success: true,
      members: formattedMembers,  // Directement à la racine
      projects: formattedProjects // Directement à la racine
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      message: err.message
    });
  }
}
