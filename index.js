// functions/matrice-api/src/index.js - VERSION CORRIGÉE
import { MongoClient, ObjectId } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction AppWrite Matrice API - Démarrage");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    error("❌ MONGODB_URI non configurée");
    return res.json({ 
      success: false, 
      message: "Configuration MongoDB manquante" 
    });
  }

  // 🔥 CORRECTION : Parser correctement la requête
  let requestData;
  try {
    console.log("📨 Corps de la requête reçu:", typeof req.body, req.body);
    
    // AppWrite envoie les données dans req.body.data
    if (req.body && req.body.data) {
      requestData = typeof req.body.data === 'string' 
        ? JSON.parse(req.body.data) 
        : req.body.data;
    } else {
      requestData = req.body;
    }
    
    console.log("✅ Données parsées:", requestData);
  } catch (parseError) {
    console.error("❌ Erreur parsing requête:", parseError);
    // 🔥 CORRECTION : Retourner des données par défaut si parsing échoue
    requestData = {
      path: '/api/v1/all-data/matrix-data',
      method: 'GET'
    };
  }

  const { path, method, body, headers } = requestData;
  
  log(`📨 Requête reçue: ${method} ${path}`);
  log("📦 Corps de la requête:", body ? JSON.stringify(body).substring(0, 200) + "..." : "Aucun corps");

  let client;

  try {
    // Connexion MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);

    // 🔥 CORRECTION : Router vers la bonne fonction
    let response;
    
    if (path === '/api/v1/all-data/matrix-data' || path === '/') {
      response = await handleGetAllMatrixData(db);
    } else {
      response = {
        success: false,
        message: `Route non trouvée: ${path}`,
        availableRoutes: ['/api/v1/all-data/matrix-data']
      };
    }

    await client.close();
    
    log(`✅ Réponse envoyée pour ${path}`);
    return res.json({
      success: true,
      responseBody: JSON.stringify(response),
      statusCode: 200
    });

  } catch (err) {
    error(`💥 Erreur critique: ${err.message}`);
    if (client) await client.close();
    
    return res.json({
      success: false,
      message: `Erreur serveur: ${err.message}`,
      statusCode: 500
    });
  }
}

// 🔥 FONCTION PRINCIPALE CORRIGÉE POUR RÉCUPÉRER TOUTES LES DONNÉES
async function handleGetAllMatrixData(db) {
  try {
    log('📦 Récupération de toutes les données de la matrice...');

    // 🔥 CORRECTION : Récupérer toutes les collections avec gestion d'erreur
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    log(`📋 Collections disponibles: ${collectionNames.join(', ')}`);

    // Fonction pour récupérer une collection avec gestion d'erreur
    const safeCollectionGet = async (collectionName) => {
      try {
        const data = await db.collection(collectionName).find({}).toArray();
        log(`✅ ${collectionName}: ${data.length} documents`);
        return data;
      } catch (err) {
        log(`⚠️ Erreur collection ${collectionName}: ${err.message}`);
        return [];
      }
    };

    // Récupérer toutes les collections en parallèle
    const collectionPromises = {};
    
    // Définir les collections attendues
    const expectedCollections = [
      'members', 'projects', 'groups', 'analyses', 
      'interactions', 'skills', 'specialties'
    ];

    for (const collectionName of expectedCollections) {
      collectionPromises[collectionName] = safeCollectionGet(collectionName);
    }

    // Attendre toutes les promesses
    const results = await Promise.allSettled(Object.values(collectionPromises));
    
    // Extraire les résultats
    const [
      membersResult,
      projectsResult,
      groupsResult,
      analysesResult,
      interactionsResult,
      skillsResult,
      specialtiesResult
    ] = results;

    // 🔥 CORRECTION : Gestion robuste des résultats
    const members = membersResult.status === 'fulfilled' ? membersResult.value : [];
    const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
    const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
    const analyses = analysesResult.status === 'fulfilled' ? analysesResult.value : [];
    const interactions = interactionsResult.status === 'fulfilled' ? interactionsResult.value : [];
    const skills = skillsResult.status === 'fulfilled' ? skillsResult.value : [];
    const specialties = specialtiesResult.status === 'fulfilled' ? specialtiesResult.value : [];

    // Log des erreurs
    const errors = results.filter(result => result.status === 'rejected');
    if (errors.length > 0) {
      errors.forEach((err, index) => {
        log(`❌ Erreur collection ${index}: ${err.reason.message}`);
      });
    }

    // Fonction de nettoyage des tableaux
    const cleanArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data.filter(item => item && item !== '');
      if (typeof data === 'string') return data.split(',').map(item => item.trim()).filter(item => item);
      return [String(data)].filter(item => item && item !== '');
    };

    // 🔥 CORRECTION : Formater les membres avec gestion d'erreur
    const formattedMembers = members.map(member => {
      try {
        return {
          _id: member._id?.toString(),
          name: member.name || '',
          title: member.title || '',
          email: member.email || '',
          organization: member.organization || '',
          specialties: cleanArray(member.specialties),
          skills: cleanArray(member.skills),
          location: member.location || '',
          experienceYears: member.experienceYears || 0,
          projects: cleanArray(member.projects),
          availability: member.availability || '',
          statutMembre: member.statutMembre || 'Actif',
          isActive: member.isActive !== false,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
          // Champs supplémentaires pour compatibilité
          entreprise: member.entreprise || member.organization || '',
          phone: member.phone || '',
          bio: member.bio || '',
          photo: member.photo || '',
          cvLink: member.cvLink || '',
          linkedin: member.linkedin || ''
        };
      } catch (memberError) {
        log(`❌ Erreur formatage membre ${member._id}: ${memberError.message}`);
        return null;
      }
    }).filter(member => member !== null);

    // Formater les autres collections
    const formattedProjects = projects.map(project => ({
      _id: project._id?.toString(),
      title: project.title || 'Sans titre',
      description: project.description || '',
      status: project.status || 'idea',
      organization: project.organization || '',
      tags: cleanArray(project.tags),
      members: cleanArray(project.members),
      createdAt: project.createdAt,
      importedFromMember: project.importedFromMember || false,
      memberSource: project.memberSource || ''
    }));

    const formattedGroups = groups.map(group => ({
      _id: group._id?.toString(),
      name: group.name || '',
      description: group.description || '',
      type: group.type || 'technique',
      privacy: group.privacy || 'public',
      tags: cleanArray(group.tags),
      members: cleanArray(group.members),
      leader: group.leader?.toString(),
      memberCount: group.members ? group.members.length : 0,
      createdAt: group.createdAt
    }));

    const formattedAnalyses = analyses.map(analysis => ({
      _id: analysis._id?.toString(),
      type: analysis.type || 'interaction_analysis',
      title: analysis.title || '',
      description: analysis.description || '',
      analysisData: analysis.analysisData || {},
      insights: analysis.insights || {},
      suggestions: cleanArray(analysis.suggestions),
      statistics: analysis.statistics || {},
      status: analysis.status || 'completed',
      timestamp: analysis.timestamp || analysis.createdAt
    }));

    const formattedInteractions = interactions.map(interaction => ({
      _id: interaction._id?.toString(),
      type: interaction.type || 'message',
      title: interaction.title || '',
      description: interaction.description || '',
      from: interaction.from?.toString(),
      to: cleanArray(interaction.to),
      projects: cleanArray(interaction.projects),
      status: interaction.status || 'pending',
      participantCount: 1 + (interaction.to ? interaction.to.length : 0),
      createdAt: interaction.createdAt
    }));

    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || 'technique',
      description: skill.description || '',
      memberCount: skill.memberCount || 0
    }));

    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || 'technique',
      description: specialty.description || '',
      memberCount: specialty.memberCount || 0
    }));

    log(`✅ Données formatées: ${formattedMembers.length} membres, ${formattedProjects.length} projets`);

    // 🔥 CORRECTION : Retourner la structure attendue par le frontend
    return {
      success: true,
      data: {
        members: formattedMembers,
        projects: formattedProjects,
        groups: formattedGroups,
        analyses: formattedAnalyses,
        interactions: formattedInteractions,
        skills: formattedSkills,
        specialties: formattedSpecialties
      },
      metadata: {
        totals: {
          members: formattedMembers.length,
          projects: formattedProjects.length,
          groups: formattedGroups.length,
          analyses: formattedAnalyses.length,
          interactions: formattedInteractions.length,
          skills: formattedSkills.length,
          specialties: formattedSpecialties.length
        },
        timestamp: new Date().toISOString(),
        database: DB_NAME
      },
      message: `Données chargées: ${formattedMembers.length} membres, ${formattedProjects.length} projets`
    };

  } catch (err) {
    log('❌ Erreur récupération données matrice:', err);
    
    // 🔥 CORRECTION : Retourner une structure vide en cas d'erreur
    return {
      success: true,
      data: {
        members: [],
        projects: [],
        groups: [],
        analyses: [],
        interactions: [],
        skills: [],
        specialties: []
      },
      metadata: {
        totals: {
          members: 0,
          projects: 0,
          groups: 0,
          analyses: 0,
          interactions: 0,
          skills: 0,
          specialties: 0
        },
        timestamp: new Date().toISOString(),
        database: DB_NAME,
        error: err.message
      },
      message: "Aucune donnée trouvée dans la base"
    };
  }
}
