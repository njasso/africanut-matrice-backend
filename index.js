// functions/get-matrice/src/index.js - VERSION CORRIGÉE AVEC PARSING DES CHAMPS
import { MongoClient } from "mongodb";

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - VERSION AVEC PARSING");

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

    // Récupération des données
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

    log(`📊 DONNÉES BRUTES: ${members.length} membres, ${skills.length} compétences, ${specialties.length} spécialités, ${projects.length} projets, ${interactions.length} interactions`);

    // 🔥 CORRECTION : Fonction pour parser les chaînes en tableaux
    const parseStringToArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === 'string') {
        // Séparer par virgules, points-virgules, ou "&"
        return data
          .split(/[,;&]/)
          .map(item => item.trim())
          .filter(item => item && item !== '');
      }
      return [String(data)];
    };

    // 🔥 CORRECTION : Fonction pour corriger les URLs
    const fixAssetUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('../assets/')) {
        return url.replace('../assets/', '/assets/');
      }
      return url;
    };

    // 🔥 CORRECTION : Formatage COMPLET des membres avec parsing
    const formattedMembers = members.map(member => {
      // Parser les spécialités et compétences
      const memberSpecialties = parseStringToArray(member.specialties);
      const memberSkills = parseStringToArray(member.skills);
      const memberProjects = parseStringToArray(member.projects);

      // Corriger les URLs
      const photoUrl = fixAssetUrl(member.photo);
      const cvUrl = fixAssetUrl(member.cvLink);

      log(`🔍 Membre ${member.name}:`, {
        specialtiesRaw: member.specialties,
        specialtiesParsed: memberSpecialties,
        skillsRaw: member.skills,
        skillsParsed: memberSkills
      });

      return {
        _id: member._id?.toString(),
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        phone: member.phone || '',
        organization: member.organization || '',
        location: member.location || '',
        
        // 🔥 CORRECTION : Champs parsés en tableaux
        specialties: memberSpecialties,
        skills: memberSkills,
        projects: memberProjects,
        
        experienceYears: member.experienceYears || 0,
        bio: member.bio || '',
        availability: member.availability || '',
        statutMembre: member.statutMembre || 'Actif',
        
        // URLs corrigées
        photo: photoUrl,
        cvLink: cvUrl,
        linkedin: member.linkedin || '',
        
        isActive: member.isActive !== undefined ? member.isActive : true,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      };
    });

    // Formater les autres collections
    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || '',
      description: skill.description || '',
      memberCount: skill.memberCount || 0
    }));

    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || '',
      description: specialty.description || '',
      memberCount: specialty.memberCount || 0
    }));

    const formattedProjects = projects.map(project => ({
      _id: project._id?.toString(),
      name: project.name || project.title || '',
      title: project.title || project.name || '',
      description: project.description || '',
      status: project.status || 'active',
      members: Array.isArray(project.members) ? project.members : [],
      organization: project.organization || '',
      tags: Array.isArray(project.tags) ? project.tags : [],
      createdAt: project.createdAt
    }));

    const formattedInteractions = interactions.map(interaction => ({
      _id: interaction._id?.toString(),
      type: interaction.type || '',
      title: interaction.title || '',
      description: interaction.description || '',
      from: interaction.from || '',
      to: Array.isArray(interaction.to) ? interaction.to : [],
      projects: Array.isArray(interaction.projects) ? interaction.projects : [],
      status: interaction.status || '',
      participantCount: 1 + (interaction.to ? interaction.to.length : 0),
      createdAt: interaction.createdAt
    }));

    await client.close();

    // 🔥 STATISTIQUES DÉTAILLÉES
    const stats = {
      membersWithSpecialties: formattedMembers.filter(m => m.specialties.length > 0).length,
      membersWithSkills: formattedMembers.filter(m => m.skills.length > 0).length,
      membersWithBoth: formattedMembers.filter(m => m.specialties.length > 0 && m.skills.length > 0).length,
      totalSpecialties: [...new Set(formattedMembers.flatMap(m => m.specialties))].length,
      totalSkills: [...new Set(formattedMembers.flatMap(m => m.skills))].length
    };

    log("🎯 STATISTIQUES FINALES:", stats);

    // Réponse finale
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
        collections: collectionNames
      },
      message: `Données chargées: ${formattedMembers.length} membres (${stats.membersWithSpecialties} avec spécialités, ${stats.membersWithSkills} avec compétences)`
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

export default handler;
