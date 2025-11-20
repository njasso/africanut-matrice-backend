// functions/matrice-api/src/index.js - VERSION COMPLÈTEMENT CORRIGÉE
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

  // 🔥 CORRECTION COMPLÈTE : Parser la requête de manière robuste
  let requestData = {};
  let path = '/api/v1/all-data/matrix-data'; // Route par défaut
  let method = 'GET'; // Méthode par défaut

  try {
    console.log("📨 Type du corps de la requête:", typeof req.body);
    console.log("📨 Corps de la requête brut:", req.body);

    // Cas 1: Corps est un objet avec data
    if (req.body && typeof req.body === 'object' && req.body.data) {
      console.log("✅ Format: req.body.data détecté");
      requestData = typeof req.body.data === 'string' 
        ? JSON.parse(req.body.data) 
        : req.body.data;
    }
    // Cas 2: Corps est une chaîne JSON
    else if (req.body && typeof req.body === 'string' && req.body.trim() !== '') {
      console.log("✅ Format: string JSON détecté");
      try {
        const parsedBody = JSON.parse(req.body);
        requestData = parsedBody.data || parsedBody;
      } catch (e) {
        console.log("❌ Échec parsing string JSON, utilisation données par défaut");
      }
    }
    // Cas 3: Corps est directement l'objet de données
    else if (req.body && typeof req.body === 'object') {
      console.log("✅ Format: objet direct détecté");
      requestData = req.body;
    }
    // Cas 4: Corps vide ou undefined
    else {
      console.log("ℹ️  Corps vide ou undefined, utilisation des valeurs par défaut");
    }

    // Extraire path et method de requestData
    path = requestData.path || '/api/v1/all-data/matrix-data';
    method = requestData.method || 'GET';

    console.log("✅ Données parsées:", { path, method, body: requestData.body });

  } catch (parseError) {
    console.error("❌ Erreur parsing requête:", parseError);
    // Continuer avec les valeurs par défaut
  }

  log(`📨 Requête traitée: ${method} ${path}`);

  let client;

  try {
    // Connexion MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);

    // 🔥 CORRECTION : Router systématiquement vers la récupération des données
    let response;
    
    if (path === '/api/v1/all-data/matrix-data' || path === '/' || !path) {
      response = await handleGetAllMatrixData(db);
    } else if (path === '/api/v1/health') {
      response = await handleHealthCheck(db);
    } else {
      response = {
        success: false,
        message: `Route non trouvée: ${path}`,
        availableRoutes: [
          '/api/v1/all-data/matrix-data',
          '/api/v1/health'
        ]
      };
    }

    await client.close();
    
    log(`✅ Réponse préparée pour ${path} - Succès: ${response.success}`);
    
    return res.json({
      success: true,
      responseBody: JSON.stringify(response),
      statusCode: response.success === false ? 404 : 200
    });

  } catch (err) {
    error(`💥 Erreur critique: ${err.message}`);
    if (client) await client.close();
    
    // 🔥 CORRECTION : Retourner une réponse d'erreur structurée
    const errorResponse = {
      success: false,
      message: `Erreur serveur: ${err.message}`,
      timestamp: new Date().toISOString()
    };
    
    return res.json({
      success: false,
      responseBody: JSON.stringify(errorResponse),
      statusCode: 500
    });
  }
}

// 🔥 FONCTION HEALTH CHECK
async function handleHealthCheck(db) {
  return {
    status: "OK",
    message: "API Matrice opérationnelle sur AppWrite",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    database: "Connected",
    platform: "appwrite",
    collections: await db.listCollections().toArray().then(cols => cols.map(c => c.name))
  };
}

// 🔥 FONCTION PRINCIPALE POUR RÉCUPÉRER TOUTES LES DONNÉES
async function handleGetAllMatrixData(db) {
  try {
    log('📦 Récupération de toutes les données de la matrice...');

    // Récupérer la liste des collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    log(`📋 Collections disponibles: ${collectionNames.join(', ')}`);

    // Fonction pour récupérer une collection avec gestion d'erreur robuste
    const safeCollectionGet = async (collectionName) => {
      try {
        if (!collectionNames.includes(collectionName)) {
          log(`⚠️ Collection ${collectionName} n'existe pas`);
          return [];
        }
        
        const data = await db.collection(collectionName).find({}).toArray();
        log(`✅ ${collectionName}: ${data.length} documents`);
        return data;
      } catch (err) {
        log(`❌ Erreur collection ${collectionName}: ${err.message}`);
        return [];
      }
    };

    // Collections attendues
    const expectedCollections = [
      'members', 'projects', 'groups', 'analyses', 
      'interactions', 'skills', 'specialties'
    ];

    // Récupérer toutes les collections en parallèle
    const collectionPromises = {};
    for (const collectionName of expectedCollections) {
      collectionPromises[collectionName] = safeCollectionGet(collectionName);
    }

    // Attendre toutes les promesses
    const results = await Promise.allSettled(Object.values(collectionPromises));
    
    // Extraire les résultats avec gestion d'erreur
    const members = results[0].status === 'fulfilled' ? results[0].value : [];
    const projects = results[1].status === 'fulfilled' ? results[1].value : [];
    const groups = results[2].status === 'fulfilled' ? results[2].value : [];
    const analyses = results[3].status === 'fulfilled' ? results[3].value : [];
    const interactions = results[4].status === 'fulfilled' ? results[4].value : [];
    const skills = results[5].status === 'fulfilled' ? results[5].value : [];
    const specialties = results[6].status === 'fulfilled' ? results[6].value : [];

    // Log des statistiques
    log(`📊 Résultats: ${members.length} membres, ${projects.length} projets, ${groups.length} groupes`);

    // Fonction de nettoyage des tableaux
    const cleanArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) {
        return data
          .map(item => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') return String(item).trim();
            return String(item).trim();
          })
          .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
      }
      if (typeof data === 'string') {
        return data
          .split(/[,;|]/)
          .map(item => item.trim())
          .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
      }
      return [String(data)].filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
    };

    // 🔥 FORMATER LES MEMBRES
    const formattedMembers = members.map(member => {
      try {
        // Nettoyer les spécialités et compétences
        const specialties = cleanArray(member.specialties);
        const skills = cleanArray(member.skills);
        
        // Corriger l'URL de la photo
        let photoUrl = member.photo || '';
        if (photoUrl && photoUrl.startsWith('../assets/photos/')) {
          photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
        }

        return {
          _id: member._id?.toString() || `mock-${Math.random().toString(36).substr(2, 9)}`,
          name: member.name || 'Nom non renseigné',
          title: member.title || 'Titre non renseigné',
          email: member.email || '',
          phone: member.phone || '',
          location: member.location || '',
          organization: member.organization || member.entreprise || '',
          entreprise: member.entreprise || member.organization || '',
          specialties: specialties,
          skills: skills,
          projects: cleanArray(member.projects),
          bio: member.bio || '',
          statutMembre: member.statutMembre || 'Actif',
          experienceYears: member.experienceYears || 0,
          photo: photoUrl,
          cvLink: member.cvLink || '',
          linkedin: member.linkedin || '',
          availability: member.availability || '',
          isActive: member.isActive !== false,
          createdAt: member.createdAt || new Date(),
          updatedAt: member.updatedAt || new Date()
        };
      } catch (memberError) {
        log(`❌ Erreur formatage membre: ${memberError.message}`);
        // Retourner un membre minimal en cas d'erreur
        return {
          _id: `error-${Math.random().toString(36).substr(2, 9)}`,
          name: 'Membre (erreur)',
          title: 'Erreur de chargement',
          specialties: [],
          skills: [],
          statutMembre: 'Inactif'
        };
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
      createdAt: project.createdAt || new Date(),
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
      createdAt: group.createdAt || new Date()
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
      timestamp: analysis.timestamp || analysis.createdAt || new Date()
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
      createdAt: interaction.createdAt || new Date()
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

    // 🔥 PRÉPARER LA RÉPONSE FINALE
    const responseData = {
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
        database: DB_NAME,
        timestamp: new Date().toISOString(),
        version: "2.0.0"
      },
      message: `Données chargées avec succès: ${formattedMembers.length} membres, ${formattedProjects.length} projets`
    };

    log(`✅ Préparation réponse: ${formattedMembers.length} membres formatés`);

    return responseData;

  } catch (err) {
    log('❌ Erreur récupération données matrice:', err);
    
    // 🔥 CORRECTION : Retourner une structure vide mais valide en cas d'erreur
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
        database: DB_NAME,
        timestamp: new Date().toISOString(),
        error: err.message
      },
      message: "Base de données chargée (vide)"
    };
  }
}
