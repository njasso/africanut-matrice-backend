// functions/get-matrice/src/index.js - VERSION COMPLÈTEMENT CORRIGÉE
import { MongoClient } from "mongodb";

// 🔥 CORRECTION : Exporter comme fonction nommée
export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - VERSION CORRIGÉE");

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
    
    // Vérification des collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    log(`📋 Collections disponibles: ${collectionNames.join(', ')}`);

    // Fonction pour récupérer une collection
    const fetchCollection = async (collectionName) => {
      try {
        if (!collectionNames.includes(collectionName)) {
          log(`⚠️ Collection ${collectionName} non trouvée`);
          return [];
        }
        
        const collection = db.collection(collectionName);
        const result = await collection.find({}).toArray();
        log(`✅ ${collectionName}: ${result.length} documents`);
        return result;
      } catch (err) {
        error(`❌ Erreur collection ${collectionName}: ${err.message}`);
        return [];
      }
    };

    // 🔥 CORRECTION : Récupération séquentielle pour éviter les timeouts
    log("📥 Récupération des membres...");
    const members = await fetchCollection('members');
    
    log("📥 Récupération des compétences...");
    const skills = await fetchCollection('skills');
    
    log("📥 Récupération des spécialités...");
    const specialties = await fetchCollection('specialties');
    
    log("📥 Récupération des projets...");
    const projects = await fetchCollection('projects');
    
    log("📥 Récupération des interactions...");
    const interactions = await fetchCollection('interactions');

    log(`📊 DONNÉES RÉCUPÉRÉES: ${members.length} membres, ${skills.length} compétences, ${specialties.length} spécialités, ${projects.length} projets, ${interactions.length} interactions`);

    // 🔥 CORRECTION : Formatage simple et efficace
    const formattedMembers = members.map(member => ({
      _id: member._id?.toString(),
      name: member.name || '',
      title: member.title || '',
      email: member.email || '',
      phone: member.phone || '',
      organization: member.organization || '',
      location: member.location || '',
      specialties: Array.isArray(member.specialties) ? member.specialties : [],
      skills: Array.isArray(member.skills) ? member.skills : [],
      experienceYears: member.experienceYears || 0,
      bio: member.bio || '',
      projects: Array.isArray(member.projects) ? member.projects : [],
      status: member.statutMembre || 'active',
      createdAt: member.createdAt
    }));

    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || ''
    }));

    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || ''
    }));

    const formattedProjects = projects.map(project => ({
      _id: project._id?.toString(),
      name: project.name || project.title || '',
      title: project.title || project.name || '',
      description: project.description || '',
      status: project.status || 'active',
      members: Array.isArray(project.members) ? project.members : []
    }));

    const formattedInteractions = interactions.map(interaction => ({
      _id: interaction._id?.toString(),
      type: interaction.type || '',
      title: interaction.title || '',
      from: interaction.from || '',
      to: Array.isArray(interaction.to) ? interaction.to : [],
      status: interaction.status || '',
      createdAt: interaction.createdAt
    }));

    await client.close();

    // 🔥 CORRECTION : Structure de réponse SIMPLE et CLAIRE
    const responseData = {
      success: true,
      data: {
        members: formattedMembers,
        skills: formattedSkills,
        specialties: formattedSpecialties,
        projects: formattedProjects,
        interactions: formattedInteractions
      },
      metadata: {
        totals: {
          members: formattedMembers.length,
          skills: formattedSkills.length,
          specialties: formattedSpecialties.length,
          projects: formattedProjects.length,
          interactions: formattedInteractions.length
        },
        timestamp: new Date().toISOString(),
        database: DB_NAME
      },
      message: `Données chargées: ${formattedMembers.length} membres, ${formattedSkills.length} compétences`
    };

    log("✅ Données prêtes à être envoyées");
    return res.json(responseData);

  } catch (err) {
    error("❌ Erreur critique: " + err.message);
    if (client) await client.close();
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des données",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

// 🔥 CORRECTION : Exporter aussi comme default pour compatibilité
export default handler;
