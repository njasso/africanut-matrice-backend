// functions/get-matrice-complete/src/index.js - VERSION AVEC DEBUG

// functions/get-matrice/src/index.js - VERSION CORRIGÉE
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
    
    // Récupérer seulement la collection 'members' pour commencer
    const membersCollection = db.collection('members');
    const members = await membersCollection.find({}).toArray();
    
    // Formater les données
    const formattedMembers = members.map(member => ({
      ...member,
      _id: member._id?.toString()
    }));

    await client.close();
    log(`✅ ${formattedMembers.length} membres récupérés`);

    // ⚡ IMPORTANT: Retourner le format EXACT attendu par le frontend
    return res.json({
      success: true,
      data: {
        members: formattedMembers,
        // Vous pouvez ajouter d'autres collections plus tard
        projects: [],
        skills: [],
        specialties: []
      },
      total: formattedMembers.length,
      message: "Données chargées avec succès"
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      error: err.message
    });
  }
}
