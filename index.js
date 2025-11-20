// functions/matrice-api/src/index.js - FONCTION COMPLÈTE
import { MongoClient, ObjectId } from "mongodb";
import express from "express";

const app = express();
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// 🔹 CONNEXION MONGODB
let mongoClient = null;
const connectMongoDB = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGODB_URI non configurée");
  }
  
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("✅ Connecté à MongoDB Atlas");
  }
  
  return mongoClient.db(DB_NAME);
};

// 🔹 FONCTION DE NETTOYAGE DES DONNÉES
const cleanArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(item => item && item !== '');
  if (typeof data === 'string') return data.split(',').map(item => item.trim()).filter(item => item);
  return [String(data)].filter(item => item && item !== '');
};

const cleanData = (rawData, collectionType) => {
  const cleaned = { ...rawData };
  
  // Nettoyer selon le type de collection
  switch (collectionType) {
    case 'members':
      cleaned.specialties = cleanArray(cleaned.specialties);
      cleaned.skills = cleanArray(cleaned.skills);
      cleaned.projects = cleanArray(cleaned.projects);
      break;
      
    case 'projects':
    case 'groups':
      cleaned.tags = cleanArray(cleaned.tags);
      cleaned.members = cleanArray(cleaned.members);
      break;
      
    case 'analyses':
      if (cleaned.insights && typeof cleaned.insights === 'string') {
        try {
          cleaned.insights = JSON.parse(cleaned.insights);
        } catch (e) {
          cleaned.insights = {};
        }
      }
      cleaned.suggestions = cleanArray(cleaned.suggestions);
      break;
      
    case 'interactions':
      cleaned.to = cleanArray(cleaned.to);
      cleaned.projects = cleanArray(cleaned.projects);
      break;
  }
  
  return cleaned;
};

// 🔹 ROUTES API

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: "OK",
    message: "API Matrice opérationnelle",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// Test synchronisation MongoDB
app.get('/api/v1/test-mongodb-sync', async (req, res) => {
  try {
    const db = await connectMongoDB();
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    res.json({
      success: true,
      message: "Connexion MongoDB établie",
      connected: true,
      database: DB_NAME,
      collections: collectionNames,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur connexion MongoDB",
      error: error.message
    });
  }
});

// Synchronisation universelle MongoDB
app.post('/api/v1/sync-mongodb', async (req, res) => {
  const { collection, data, operation = 'create', id = null, filter = {}, bulkData = [] } = req.body;
  
  const validCollections = ['members', 'projects', 'groups', 'analyses', 'interactions', 'skills', 'specialties'];
  
  if (!collection || !validCollections.includes(collection)) {
    return res.status(400).json({
      success: false,
      message: `Collection invalide: ${collection}. Valides: ${validCollections.join(', ')}`
    });
  }

  try {
    const db = await connectMongoDB();
    const collectionObj = db.collection(collection);

    let result;
    let mongoId;

    switch (operation) {
      case 'create':
        const dataToInsert = cleanData(data, collection);
        dataToInsert.createdAt = new Date();
        dataToInsert.updatedAt = new Date();
        
        result = await collectionObj.insertOne(dataToInsert);
        mongoId = result.insertedId;
        break;

      case 'update':
        if (!id) {
          return res.status(400).json({
            success: false,
            message: "ID requis pour la mise à jour"
          });
        }

        const updateData = cleanData(data, collection);
        updateData.updatedAt = new Date();
        
        result = await collectionObj.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        mongoId = id;
        break;

      case 'delete':
        if (!id) {
          return res.status(400).json({
            success: false,
            message: "ID requis pour la suppression"
          });
        }

        result = await collectionObj.deleteOne({ _id: new ObjectId(id) });
        break;

      case 'bulk':
        if (!bulkData.length) {
          return res.status(400).json({
            success: false,
            message: "Données bulk manquantes"
          });
        }

        const bulkOps = bulkData.map(item => ({
          updateOne: {
            filter: { _id: new ObjectId(item.id) },
            update: { 
              $set: { 
                ...cleanData(item.data, collection),
                updatedAt: new Date() 
              },
              $setOnInsert: { createdAt: new Date() }
            },
            upsert: true
          }
        }));
        
        result = await collectionObj.bulkWrite(bulkOps);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Opération non supportée: ${operation}`
        });
    }

    res.json({
      success: true,
      operation,
      collection,
      mongoId: mongoId?.toString(),
      result: {
        insertedId: result.insertedId?.toString(),
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount,
        upsertedCount: result.upsertedCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Erreur synchronisation ${collection}:`, error);
    res.status(500).json({
      success: false,
      operation,
      collection,
      message: `Erreur synchronisation: ${error.message}`
    });
  }
});

// Récupération de toutes les données de la matrice
app.get('/api/v1/all-data/matrix-data', async (req, res) => {
  try {
    const db = await connectMongoDB();
    
    // Récupérer toutes les collections en parallèle
    const [
      members,
      projects,
      groups,
      analyses,
      interactions,
      skills,
      specialties
    ] = await Promise.all([
      db.collection('members').find({}).toArray(),
      db.collection('projects').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('groups').find({}).toArray(),
      db.collection('analyses').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('interactions').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('skills').find({}).toArray(),
      db.collection('specialties').find({}).toArray()
    ]);

    // Formater les données
    const formatMember = (member) => ({
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
      updatedAt: member.updatedAt
    });

    const formatProject = (project) => ({
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
    });

    res.json({
      success: true,
      data: {
        members: members.map(formatMember),
        projects: projects.map(formatProject),
        groups: groups.map(group => ({
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
        })),
        analyses: analyses.map(analysis => ({
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
        })),
        interactions: interactions.map(interaction => ({
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
        })),
        skills: skills.map(skill => ({
          _id: skill._id?.toString(),
          name: skill.name || '',
          category: skill.category || 'technique',
          description: skill.description || '',
          memberCount: skill.memberCount || 0
        })),
        specialties: specialties.map(specialty => ({
          _id: specialty._id?.toString(),
          name: specialty.name || '',
          category: specialty.category || 'technique',
          description: specialty.description || '',
          memberCount: specialty.memberCount || 0
        }))
      },
      metadata: {
        totals: {
          members: members.length,
          projects: projects.length,
          groups: groups.length,
          analyses: analyses.length,
          interactions: interactions.length,
          skills: skills.length,
          specialties: specialties.length
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération données matrice:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données',
      error: error.message
    });
  }
});

// Gestion des analyses de synergies
app.get('/api/v1/synergy-analysis', async (req, res) => {
  try {
    const db = await connectMongoDB();
    const analyses = await db.collection('analyses')
      .find({ type: 'professional_synergy_analysis' })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: analyses,
      pagination: {
        page: 1,
        limit: 20,
        total: analyses.length,
        pages: 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur récupération analyses',
      error: error.message
    });
  }
});

app.post('/api/v1/synergy-analysis', async (req, res) => {
  try {
    const db = await connectMongoDB();
    const analysisData = {
      ...req.body,
      type: 'professional_synergy_analysis',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('analyses').insertOne(analysisData);

    res.json({
      success: true,
      message: 'Analyse sauvegardée avec succès',
      data: { ...analysisData, _id: result.insertedId },
      analysisId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur sauvegarde analyse',
      error: error.message
    });
  }
});

// Statistiques
app.get('/api/v1/stats', async (req, res) => {
  try {
    const db = await connectMongoDB();
    
    const [
      totalMembers,
      totalProjects,
      totalGroups,
      totalAnalyses,
      totalInteractions,
      activeMembers
    ] = await Promise.all([
      db.collection('members').countDocuments(),
      db.collection('projects').countDocuments(),
      db.collection('groups').countDocuments(),
      db.collection('analyses').countDocuments(),
      db.collection('interactions').countDocuments(),
      db.collection('members').countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        totalMembers,
        totalProjects,
        totalGroups,
        totalAnalyses,
        totalInteractions,
        activeMembers,
        completedProjects: 0, // À implémenter
        upcomingInteractions: 0 // À implémenter
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur récupération statistiques',
      error: error.message
    });
  }
});

// Route par défaut
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route non trouvée: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET  /api/v1/health',
      'GET  /api/v1/all-data/matrix-data',
      'POST /api/v1/sync-mongodb',
      'GET  /api/v1/synergy-analysis',
      'POST /api/v1/synergy-analysis',
      'GET  /api/v1/stats',
      'GET  /api/v1/test-mongodb-sync'
    ]
  });
});

// Gestionnaire principal
export default async function handler({ req, res, log, error }) {
  log(`🚀 Requête reçue: ${req.method} ${req.path}`);
  
  try {
    // Simuler l'objet Express
    const expressReq = {
      method: req.method,
      path: req.path,
      query: req.query || {},
      body: req.body || {},
      headers: req.headers || {}
    };

    const expressRes = {
      statusCode: 200,
      headers: {},
      json: (data) => {
        res.json(data);
      },
      status: (code) => {
        expressRes.statusCode = code;
        return expressRes;
      }
    };

    // Router la requête
    await app(expressReq, expressRes);
    
  } catch (err) {
    error('❌ Erreur handler:', err);
    res.json({
      success: false,
      message: 'Erreur interne du serveur',
      error: err.message
    });
  }
}
