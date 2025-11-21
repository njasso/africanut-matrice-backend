// functions/get-members/src/index.js
import { MongoClient } from "mongodb";

const MONGO_TIMEOUT_MS = 30000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-members");

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
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    
    // Récupération des membres avec projection optimisée
    const members = await db.collection('members').find({}, {
      projection: {
        name: 1, title: 1, email: 1, phone: 1, organization: 1, location: 1,
        specialties: 1, skills: 1, projects: 1, experienceYears: 1, bio: 1,
        availability: 1, statutMembre: 1, photo: 1, cvLink: 1, linkedin: 1,
        isActive: 1, createdAt: 1, updatedAt: 1
      }
    }).maxTimeMS(MONGO_TIMEOUT_MS).toArray();

    log(`✅ ${members.length} membres récupérés`);

    // Formatage des membres
    const parseStringToArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === 'string') {
        return data.split(/[,;&|]/).map(item => item.trim()).filter(Boolean);
      }
      return [String(data)];
    };

    const fixAssetUrl = (url) => {
      if (!url) return '';
      return url.startsWith('../assets/') ? url.replace('../assets/', '/assets/') : url;
    };

    const formattedMembers = members.map(member => ({
      _id: member._id?.toString(),
      name: member.name || '',
      title: member.title || '',
      email: member.email || '',
      phone: member.phone || '',
      organization: member.organization || '',
      location: member.location || '',
      specialties: parseStringToArray(member.specialties),
      skills: parseStringToArray(member.skills),
      projects: parseStringToArray(member.projects),
      experienceYears: member.experienceYears || 0,
      bio: member.bio || '',
      availability: member.availability || '',
      statutMembre: member.statutMembre || 'Actif',
      photo: fixAssetUrl(member.photo),
      cvLink: fixAssetUrl(member.cvLink),
      linkedin: member.linkedin || '',
      isActive: member.isActive !== undefined ? member.isActive : true,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
    }));

    await client.close();

    return res.json({
      success: true,
      data: formattedMembers, // ← Tableau direct
      total: formattedMembers.length,
      message: `${formattedMembers.length} membres chargés avec succès`,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur get-members: " + err.message);
    
    if (client) {
      try { await client.close(); } catch (closeErr) {}
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des membres",
      error: err.message
    });
  }
}

export default handler;
