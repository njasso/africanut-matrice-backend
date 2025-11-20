// functions/get-matrice/src/index.js - VERSION COMPLÈTE POUR TOUTES LES COLLECTIONS
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - VERSION COMPLÈTE");

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
    
    // Vérification des collections existantes
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    log(`📋 Collections disponibles: ${collectionNames.join(', ')}`);

    // Fonction pour récupérer une collection avec gestion d'erreur
    const fetchCollection = async (collectionName, options = {}) => {
      try {
        if (!collectionNames.includes(collectionName)) {
          log(`⚠️ Collection ${collectionName} non trouvée, retour tableau vide`);
          return [];
        }
        
        const collection = db.collection(collectionName);
        let query = collection.find(options.filter || {});
        
        if (options.sort) query = query.sort(options.sort);
        if (options.limit) query = query.limit(options.limit);
        if (options.fields) query = query.project(options.fields);
        
        const result = await query.toArray();
        log(`✅ ${collectionName}: ${result.length} documents`);
        return result;
      } catch (err) {
        error(`❌ Erreur collection ${collectionName}: ${err.message}`);
        return [];
      }
    };

    // Récupération parallèle de TOUTES les collections
    const [
      members,
      skills,
      specialties,
      projects,
      interactions,
      groups,
      analyses
    ] = await Promise.all([
      // Membres avec tous les champs nécessaires
      fetchCollection('members', { 
        fields: { 
          name: 1, email: 1, title: 1, organization: 1, 
          location: 1, specialties: 1, skills: 1, 
          experienceYears: 1, phone: 1, bio: 1, 
          projects: 1, status: 1, createdAt: 1 
        } 
      }),
      
      // Skills avec limite
      fetchCollection('skills', { limit: 100 }),
      
      // Specialties avec limite  
      fetchCollection('specialties', { limit: 100 }),
      
      // Projects avec champs de base
      fetchCollection('projects', { 
        limit: 100,
        fields: { name: 1, title: 1, description: 1, status: 1, members: 1 }
      }),
      
      // Interactions récentes
      fetchCollection('interactions', { 
        limit: 200,
        sort: { createdAt: -1 }
      }),
      
      // Groups
      fetchCollection('groups'),
      
      // Analyses
      fetchCollection('analyses')
    ]);

    log(`📊 DONNÉES RÉCUPÉRÉES: ${members.length} membres, ${skills.length} compétences, ${specialties.length} spécialités, ${projects.length} projets, ${interactions.length} interactions`);

    // Formater les données pour le frontend
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
      status: member.status || 'active',
      createdAt: member.createdAt
    }));

    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || '',
      description: skill.description || ''
    }));

    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || '',
      description: specialty.description || ''
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

    // Réponse finale structurée
    const responseData = {
      success: true,
      data: {
        members: formattedMembers,
        skills: formattedSkills,
        specialties: formattedSpecialties,
        projects: formattedProjects,
        interactions: formattedInteractions,
        groups: groups,
        analyses: analyses
      },
      metadata: {
        totals: {
          members: formattedMembers.length,
          skills: formattedSkills.length,
          specialties: formattedSpecialties.length,
          projects: formattedProjects.length,
          interactions: formattedInteractions.length,
          groups: groups.length,
          analyses: analyses.length
        },
        timestamp: new Date().toISOString(),
        database: DB_NAME,
        collections: collectionNames
      },
      message: `Données chargées avec succès: ${formattedMembers.length} membres, ${formattedSkills.length} compétences, ${formattedSpecialties.length} spécialités`
    };

    return res.json(responseData);

  } catch (err) {
    error("❌ Erreur critique: " + err.message);
    if (client) await client.close();
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des données",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Contactez l\'administrateur'
    });
  }
}
