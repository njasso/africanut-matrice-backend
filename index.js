// functions/get-matrice/src/index.js - VERSION OPTIMISÉE
import { MongoClient } from "mongodb";

// 🔥 Configuration des timeouts
const MONGO_TIMEOUT_MS = 30000;
const FUNCTION_TIMEOUT_MS = 40000;

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - VERSION OPTIMISÉE");

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
    // 🔥 Connexion MongoDB avec timeout
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: MONGO_TIMEOUT_MS,
      connectTimeoutMS: MONGO_TIMEOUT_MS,
      socketTimeoutMS: MONGO_TIMEOUT_MS
    });

    log("🔌 Connexion à MongoDB...");
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    
    // 🔥 Vérification rapide des collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    log(`📋 Collections disponibles: ${collectionNames.join(', ')}`);

    // 🔥 Fonction OPTIMISÉE pour récupérer une collection avec projection
    const fetchCollection = async (collectionName, projection = {}) => {
      try {
        if (!collectionNames.includes(collectionName)) {
          log(`⚠️ Collection ${collectionName} non trouvée`);
          return [];
        }
        
        const collection = db.collection(collectionName);
        
        // 🔥 OPTIMISATION: Utiliser projection pour réduire la taille des données
        const result = await collection.find({}, { projection })
          .maxTimeMS(MONGO_TIMEOUT_MS)
          .toArray();
          
        log(`✅ ${collectionName}: ${result.length} documents`);
        return result;
      } catch (err) {
        error(`❌ Erreur collection ${collectionName}: ${err.message}`);
        return [];
      }
    };

    // 🔥 OPTIMISATION: Récupération PARALLÈLE des collections principales
    log("📥 Récupération PARALLÈLE des données...");
    
    const [members, skills, specialties, projects, interactions] = await Promise.all([
      // Members - projection pour éviter de récupérer tous les champs
      fetchCollection('members', {
        name: 1, title: 1, email: 1, phone: 1, organization: 1, location: 1,
        specialties: 1, skills: 1, projects: 1, experienceYears: 1, bio: 1,
        availability: 1, statutMembre: 1, photo: 1, cvLink: 1, linkedin: 1,
        isActive: 1, createdAt: 1, updatedAt: 1
      }),
      
      // Autres collections avec projection minimale
      fetchCollection('skills', { name: 1, category: 1, description: 1, memberCount: 1 }),
      fetchCollection('specialties', { name: 1, category: 1, description: 1, memberCount: 1 }),
      fetchCollection('projects', { name: 1, title: 1, description: 1, status: 1, members: 1, organization: 1, tags: 1, createdAt: 1 }),
      fetchCollection('interactions', { type: 1, title: 1, description: 1, from: 1, to: 1, projects: 1, status: 1, createdAt: 1 })
    ]);

    log(`📊 DONNÉES BRUTES: ${members.length} membres, ${skills.length} compétences, ${specialties.length} spécialités, ${projects.length} projets, ${interactions.length} interactions`);

    // 🔥 OPTIMISATION: Fonctions de parsing plus efficaces
    const parseStringToArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === 'string') {
        // Regex optimisée pour le parsing
        return data.split(/[,;&|]/).map(item => item.trim()).filter(Boolean);
      }
      return [String(data)];
    };

    const fixAssetUrl = (url) => {
      if (!url) return '';
      return url.startsWith('../assets/') ? url.replace('../assets/', '/assets/') : url;
    };

    // 🔥 OPTIMISATION: Formatage des membres avec batch processing
    log("🔄 Formatage des membres...");
    const formattedMembers = members.map((member, index) => {
      // Log progressif pour éviter de surcharger les logs
      if (index % 50 === 0) {
        log(`📝 Formatage membre ${index + 1}/${members.length}...`);
      }

      const memberSpecialties = parseStringToArray(member.specialties);
      const memberSkills = parseStringToArray(member.skills);
      const memberProjects = parseStringToArray(member.projects);

      return {
        _id: member._id?.toString(),
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        phone: member.phone || '',
        organization: member.organization || '',
        location: member.location || '',
        specialties: memberSpecialties,
        skills: memberSkills,
        projects: memberProjects,
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
      };
    });

    // 🔥 OPTIMISATION: Formatage parallèle des autres collections
    log("🔄 Formatage des autres collections...");
    const [formattedSkills, formattedSpecialties, formattedProjects, formattedInteractions] = await Promise.all([
      Promise.resolve(skills.map(skill => ({
        _id: skill._id?.toString(),
        name: skill.name || '',
        category: skill.category || '',
        description: skill.description || '',
        memberCount: skill.memberCount || 0
      }))),
      
      Promise.resolve(specialties.map(specialty => ({
        _id: specialty._id?.toString(),
        name: specialty.name || '',
        category: specialty.category || '',
        description: specialty.description || '',
        memberCount: specialty.memberCount || 0
      }))),
      
      Promise.resolve(projects.map(project => ({
        _id: project._id?.toString(),
        name: project.name || project.title || '',
        title: project.title || project.name || '',
        description: project.description || '',
        status: project.status || 'active',
        members: Array.isArray(project.members) ? project.members : [],
        organization: project.organization || '',
        tags: Array.isArray(project.tags) ? project.tags : [],
        createdAt: project.createdAt
      }))),
      
      Promise.resolve(interactions.map(interaction => ({
        _id: interaction._id?.toString(),
        type: interaction.type || '',
        title: interaction.title || '',
        description: interaction.description || '',
        from: interaction.from || '',
        to: Array.isArray(interaction.to) ? interaction.to : [],
        projects: Array.isArray(interaction.projects) ? interaction.projects : [],
        status: interaction.status || '',
        participantCount: 1 + (Array.isArray(interaction.to) ? interaction.to.length : 0),
        createdAt: interaction.createdAt
      })))
    ]);

    // Fermeture rapide de la connexion
    await client.close();
    log("🔌 Connexion MongoDB fermée");

    // 🔥 OPTIMISATION: Statistiques calculées efficacement
    const stats = {
      membersWithSpecialties: formattedMembers.filter(m => m.specialties.length > 0).length,
      membersWithSkills: formattedMembers.filter(m => m.skills.length > 0).length,
      membersWithBoth: formattedMembers.filter(m => m.specialties.length > 0 && m.skills.length > 0).length,
      totalSpecialties: new Set(formattedMembers.flatMap(m => m.specialties)).size,
      totalSkills: new Set(formattedMembers.flatMap(m => m.skills)).size,
      activeMembers: formattedMembers.filter(m => m.isActive).length
    };

    log("🎯 STATISTIQUES FINALES:", stats);

    // 🔥 OPTIMISATION: Réponse structurée avec données essentielles
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
        skillsStats: stats,
        timestamp: new Date().toISOString(),
        database: DB_NAME,
        version: "2.0-optimized",
        processingTime: "optimized"
      },
      message: `✅ Données chargées: ${formattedMembers.length} membres, ${formattedProjects.length} projets`
    };

    log("✅ Préparation réponse finale");
    return res.json(responseData);

  } catch (err) {
    // 🔥 Gestion d'erreur améliorée
    error("❌ Erreur critique: " + err.message);
    error("Stack: " + err.stack);
    
    if (client) {
      try {
        await client.close();
      } catch (closeErr) {
        error("Erreur fermeture client: " + closeErr.message);
      }
    }
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des données",
      error: err.message,
      suggestion: "Vérifiez la connexion MongoDB et les variables d'environnement",
      timestamp: new Date().toISOString()
    });
  }
}

export default handler;
