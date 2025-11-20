// server.js - VERSION COMPLÈTEMENT MISE À JOUR ET CORRIGÉE
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// 🔹 CONFIGURATION SPÉCIFIQUE APPWRITE
const isAppwrite = process.env.APPWRITE_FUNCTION_ID !== undefined;
const PORT = process.env.PORT || 3000;

// 🔹 CORRECTION : Utiliser MONGODB_URI au lieu de MONGO_URI
const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!mongoURI) {
  console.error('❌ MONGODB_URI is required');
  process.exit(1);
}

// 🔹 MIDDLEWARE CORS OPTIMISÉ POUR NETLIFY
app.use(cors({
  origin: function(origin, callback) {
    // Liste des origines autorisées pour Netlify
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : [
          'https://resplendent-nasturtium-1fb598.netlify.app',
          'https://*.netlify.app',
          'http://localhost:3000',
          'http://localhost:5173',
          'https://localhost:5173'
        ];
    
    // En développement, autoriser toutes les origines
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Vérifier si l'origine est autorisée
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp('^' + allowed.replace('*.', '.*\\.') + '$');
        return regex.test(origin);
      }
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS bloqué pour: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de sécurité
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Logging adapté
if (isAppwrite) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// 🔹 CONNEXION MONGODB
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 1,
};

mongoose.connect(mongoURI, mongooseOptions)
  .then(() => console.log('✅ MongoDB connected to Appwrite'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    if (!isAppwrite) process.exit(1);
  });

// Gestion gracieuse de la fermeture
process.on('SIGTERM', async () => {
  console.log('🔻 SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

// Import des modèles
let Member, Project, Group, Interaction, Skill, Specialty, Analysis;
try {
  Member = require('./models/Member');
  Project = require('./models/Project');
  Group = require('./models/Group');
  Interaction = require('./models/Interaction');
  Skill = require('./models/Skill');
  Specialty = require('./models/Specialty');
  Analysis = require('./models/Analysis');
  console.log('✅ All models loaded successfully');
} catch (error) {
  console.error('❌ Error loading models:', error.message);
}

// ==================== IMPORT DES ROUTES CORRIGÉES ====================

// 🔥 CORRECTION : Import des routes avec gestion d'erreur
try {
  // Routes principales
  app.use('/api/v1/analyses', require('./routes/analyses'));
  app.use('/api/v1/interactions', require('./routes/interactions'));
  app.use('/api/v1/skills', require('./routes/skills'));
  console.log('✅ All routes loaded successfully');
} catch (error) {
  console.warn('⚠️ Some routes not available:', error.message);
}

// ==================== ROUTE PRINCIPALE POUR APPWRITE ====================

// 🔹 ROUTE POUR EXÉCUTER LES FONCTIONS APPWRITE - CORRIGÉE
app.post('/api/v1/execute-function', async (req, res) => {
  try {
    const { path, method, body, headers } = req.body;
    
    console.log(`🚀 AppWrite Function Execution: ${method} ${path}`);
    
    let response;

    // 🔥 CORRECTION : Routage complet vers les handlers appropriés
    switch (path) {
      case '/api/v1/all-data/matrix-data':
        response = await handleGetAllMatrixData();
        break;
      
      case '/api/v1/synergy-analysis':
        if (method === 'POST') {
          const analysisData = body ? JSON.parse(body) : req.body;
          response = await handleSaveSynergyAnalysis(analysisData);
        } else if (method === 'GET') {
          response = await handleGetSynergyAnalyses();
        }
        break;
      
      // 🔥 AJOUT : Gestion des routes analyses
      case '/api/v1/analyses/save-synergy-analysis':
        if (method === 'POST') {
          const analysisData = body ? JSON.parse(body) : req.body;
          response = await handleSaveSynergyAnalysis(analysisData);
        }
        break;
      
      // 🔥 AJOUT : Gestion des routes interactions
      case '/api/v1/interactions':
        if (method === 'GET') {
          response = await handleGetInteractions();
        } else if (method === 'POST') {
          const interactionData = body ? JSON.parse(body) : req.body;
          response = await handleCreateInteraction(interactionData);
        }
        break;
      
      case '/api/v1/health':
        response = await handleHealthCheck();
        break;
      
      default:
        response = await handleGenericRoute(path, method, body);
    }
    
    res.json({
      success: true,
      responseBody: JSON.stringify(response),
      statusCode: 200
    });
    
  } catch (error) {
    console.error('💥 AppWrite Function Execution Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      statusCode: 500
    });
  }
});

// ==================== HANDLERS POUR LES ROUTES APPWRITE ====================

// Handler pour récupérer toutes les données de la matrice
async function handleGetAllMatrixData() {
  try {
    console.log('📦 Handling /api/v1/all-data/matrix-data request...');

    const [
      matrices,
      analyses,
      groups,
      interactions,
      members,
      projects,
      skills,
      specialties
    ] = await Promise.all([
      // Matrices collection
      mongoose.connection.db.collection('matrice').find({}).toArray().catch(() => []),
      
      // Analyses collection
      Analysis?.find({}).sort({ createdAt: -1 }).limit(50).catch(() => []) || [],
      
      // Groups collection
      Group?.find({}).populate('members', 'name email organization title').catch(() => []) || [],
      
      // Interactions collection
      Interaction?.find({}).populate('from to projects groups specialties').catch(() => []) || [],
      
      // Members collection
      Member?.find({}).select('name title email organization specialties experienceYears skills location photo status').catch(() => []) || [],
      
      // Projects collection
      Project?.find({}).populate('members', 'name email').catch(() => []) || [],
      
      // Skills collection
      mongoose.connection.db.collection('skills').find({}).toArray().catch(() => []),
      
      // Specialties collection
      Specialty?.find({}).catch(() => []) || []
    ]);

    const allData = {
      matrices: matrices || [],
      analyses: analyses || [],
      groups: groups || [],
      interactions: interactions || [],
      members: members || [],
      projects: projects || [],
      skills: skills || [],
      specialties: specialties || [],
      metadata: {
        totalMatrices: matrices?.length || 0,
        totalAnalyses: analyses?.length || 0,
        totalGroups: groups?.length || 0,
        totalInteractions: interactions?.length || 0,
        totalMembers: members?.length || 0,
        totalProjects: projects?.length || 0,
        totalSkills: skills?.length || 0,
        totalSpecialties: specialties?.length || 0,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`✅ Data retrieved: ${allData.metadata.totalMembers} members, ${allData.metadata.totalProjects} projects`);

    return {
      success: true,
      data: allData,
      message: 'Toutes les données récupérées avec succès'
    };

  } catch (error) {
    console.error('💥 Error handling matrix data:', error);
    throw error;
  }
}

// Handler pour sauvegarder une analyse de synergies - CORRIGÉ
async function handleSaveSynergyAnalysis(analysisData) {
  try {
    console.log('💾 Handling synergy analysis save...');
    
    const {
      type = 'professional_synergy_analysis',
      title,
      description,
      analysisData: synergyData,
      statistics,
      timestamp = new Date()
    } = analysisData;

    // Validation
    if (!title || !synergyData) {
      throw new Error('Titre et données d\'analyse requis');
    }

    if (!Analysis) {
      throw new Error('Analysis model not available');
    }

    // 🔥 CORRECTION : Structure compatible avec le modèle Analysis corrigé
    const newAnalysis = new Analysis({
      type: 'professional_synergy_analysis',
      title: title.trim(),
      description: description?.trim() || `Analyse des synergies professionnelles - ${new Date().toLocaleDateString('fr-FR')}`,
      
      // 🔥 Structure analysisData corrigée
      analysisData: {
        synergies: synergyData.synergies || [],
        projectOpportunities: synergyData.projectOpportunities || [],
        summary: synergyData.summary || {
          totalSynergies: synergyData.synergies?.length || 0,
          highPotentialSynergies: synergyData.synergies?.filter(s => s.potential === 'Élevé' || s.potential === 'Exceptionnel').length || 0,
          projectOpportunities: synergyData.projectOpportunities?.length || 0,
          analyzedMembers: statistics?.totalMembers || 0,
          aiEnhanced: statistics?.aiEnhanced || false,
          aiAnalysesCount: statistics?.aiEnhancedCount || 0,
          aiModel: statistics?.aiModel || null
        },
        timestamp: timestamp
      },
      
      insights: {
        totalSynergies: synergyData.synergies?.length || 0,
        highPotential: synergyData.synergies?.filter(s => s.potential === 'Élevé' || s.potential === 'Exceptionnel').length || 0,
        projectOpportunities: synergyData.projectOpportunities?.length || 0,
        analyzedMembers: statistics?.totalMembers || 0
      },
      
      suggestions: synergyData.synergies?.map(synergy => ({
        members: [synergy.member1?.name, synergy.member2?.name],
        score: synergy.score,
        potential: synergy.potential,
        reason: synergy.reason,
        recommendedActions: synergy.recommendedActions,
        type: synergy.type
      })) || [],
      
      dataSummary: {
        membersAnalyzed: statistics?.totalMembers || 0,
        projectsAnalyzed: statistics?.totalProjects || 0,
        skillsAnalyzed: statistics?.totalSkills || 0,
        specialtiesAnalyzed: statistics?.totalSpecialties || 0
      },
      
      // 🔥 CORRECTION : Statistics avec champs IA
      statistics: {
        totalMembers: statistics?.totalMembers || 0,
        totalProjects: statistics?.totalProjects || 0,
        totalSkills: statistics?.totalSkills || 0,
        totalSpecialties: statistics?.totalSpecialties || 0,
        totalSynergies: synergyData.synergies?.length || 0,
        totalOpportunities: synergyData.projectOpportunities?.length || 0,
        aiEnhanced: statistics?.aiEnhanced || false,
        aiEnhancedCount: statistics?.aiEnhancedCount || 0,
        aiModel: statistics?.aiModel || null
      },
      
      // 🔥 AJOUT : Champs IA pour le modèle
      aiEnhanced: statistics?.aiEnhanced || false,
      aiEnhancedCount: statistics?.aiEnhancedCount || 0,
      aiModel: statistics?.aiModel || null,
      
      analysisTimestamp: timestamp,
      status: 'completed'
    });

    const savedAnalysis = await newAnalysis.save();
    
    console.log(`✅ Analysis saved: ${savedAnalysis._id} - ${savedAnalysis.suggestions?.length || 0} synergies`);

    return {
      success: true,
      message: 'Analyse de synergies sauvegardée avec succès',
      data: savedAnalysis,
      analysisId: savedAnalysis._id
    };

  } catch (error) {
    console.error('💥 Error saving synergy analysis:', error);
    throw error;
  }
}

// Handler pour récupérer les analyses de synergies
async function handleGetSynergyAnalyses() {
  try {
    console.log('📥 Handling get synergy analyses...');

    if (!Analysis) {
      throw new Error('Analysis model not available');
    }

    const analyses = await Analysis.find({ 
      type: 'professional_synergy_analysis' 
    })
      .sort({ createdAt: -1 })
      .limit(20);

    const total = await Analysis.countDocuments({ 
      type: 'professional_synergy_analysis' 
    });

    console.log(`✅ ${analyses.length} synergy analyses retrieved`);

    return {
      success: true,
      data: analyses,
      pagination: {
        page: 1,
        limit: 20,
        total,
        pages: Math.ceil(total / 20)
      }
    };
  } catch (error) {
    console.error('💥 Error getting synergy analyses:', error);
    throw error;
  }
}

// 🔥 AJOUT : Handler pour les interactions
async function handleGetInteractions() {
  try {
    if (!Interaction) {
      throw new Error('Interaction model not available');
    }

    const interactions = await Interaction.find()
      .populate('from', 'name title organization')
      .populate('to', 'name title organization')
      .populate('projects', 'name status')
      .limit(50)
      .sort({ createdAt: -1 });

    return {
      success: true,
      data: interactions,
      total: interactions.length
    };
  } catch (error) {
    console.error('💥 Error getting interactions:', error);
    throw error;
  }
}

// 🔥 AJOUT : Handler pour créer une interaction
async function handleCreateInteraction(interactionData) {
  try {
    if (!Interaction) {
      throw new Error('Interaction model not available');
    }

    const newInteraction = new Interaction(interactionData);
    const savedInteraction = await newInteraction.save();

    return {
      success: true,
      data: savedInteraction,
      message: 'Interaction créée avec succès'
    };
  } catch (error) {
    console.error('💥 Error creating interaction:', error);
    throw error;
  }
}

// Handler pour health check
async function handleHealthCheck() {
  return {
    status: "OK", 
    message: "Backend fonctionnel sur Appwrite",
    platform: isAppwrite ? "appwrite" : "local",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    frontend: "https://resplendent-nasturtium-1fb598.netlify.app"
  };
}

// Handler générique pour autres routes
async function handleGenericRoute(path, method, body) {
  console.log(`🔀 Generic route handler: ${method} ${path}`);
  
  return {
    success: true,
    message: `Route ${path} handled successfully`,
    method,
    path,
    timestamp: new Date().toISOString()
  };
}

// ==================== ROUTES DIRECTES POUR LE FRONTEND ====================

// 🔹 ROUTE POUR TOUTES LES DONNÉES DE LA MATRICE (directe)
app.get('/api/v1/all-data/matrix-data', async (req, res) => {
  try {
    console.log('📦 GET /api/v1/all-data/matrix-data - Récupération de toutes les données...');

    const [
      matrices,
      analyses,
      groups,
      interactions,
      members,
      projects,
      skills,
      specialties
    ] = await Promise.all([
      mongoose.connection.db.collection('matrice').find({}).toArray().catch(() => []),
      Analysis?.find({}).sort({ createdAt: -1 }).limit(50).catch(() => []) || [],
      Group?.find({}).populate('members', 'name email organization title').catch(() => []) || [],
      Interaction?.find({}).populate('from to projects groups specialties').catch(() => []) || [],
      Member?.find({}).select('name title email organization specialties experienceYears skills location photo status').catch(() => []) || [],
      Project?.find({}).populate('members', 'name email').catch(() => []) || [],
      mongoose.connection.db.collection('skills').find({}).toArray().catch(() => []),
      Specialty?.find({}).catch(() => []) || []
    ]);

    const allData = {
      matrices: matrices || [],
      analyses: analyses || [],
      groups: groups || [],
      interactions: interactions || [],
      members: members || [],
      projects: projects || [],
      skills: skills || [],
      specialties: specialties || [],
      metadata: {
        totalMatrices: matrices?.length || 0,
        totalAnalyses: analyses?.length || 0,
        totalGroups: groups?.length || 0,
        totalInteractions: interactions?.length || 0,
        totalMembers: members?.length || 0,
        totalProjects: projects?.length || 0,
        totalSkills: skills?.length || 0,
        totalSpecialties: specialties?.length || 0,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`✅ Données récupérées: ${allData.metadata.totalMembers} membres, ${allData.metadata.totalProjects} projets, ${allData.metadata.totalAnalyses} analyses`);

    res.json({
      success: true,
      data: allData,
      message: 'Toutes les données récupérées avec succès'
    });

  } catch (error) {
    console.error('💥 GET /api/v1/all-data/matrix-data error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données complètes',
      error: isAppwrite ? 'Internal server error' : error.message
    });
  }
});

// 🔹 ROUTES POUR LES ANALYSES DE SYNERGIES (directes)
const synergyAnalysisRoutes = express.Router();

// POST - Sauvegarder une analyse de synergies - CORRIGÉ
synergyAnalysisRoutes.post('/', async (req, res) => {
  try {
    console.log('💾 POST /api/v1/synergy-analysis - Sauvegarde analyse...');
    
    const {
      type = 'professional_synergy_analysis',
      title,
      description,
      analysisData,
      statistics,
      timestamp = new Date()
    } = req.body;

    // Validation
    if (!title || !analysisData) {
      return res.status(400).json({
        success: false,
        message: 'Titre et données d\'analyse requis'
      });
    }

    if (!Analysis) {
      return res.status(500).json({
        success: false,
        message: 'Analysis model not available'
      });
    }

    // 🔥 CORRECTION : Utilisation de la même structure que handleSaveSynergyAnalysis
    const newAnalysis = new Analysis({
      type: 'professional_synergy_analysis',
      title: title.trim(),
      description: description?.trim() || `Analyse des synergies professionnelles - ${new Date().toLocaleDateString('fr-FR')}`,
      
      analysisData: {
        synergies: analysisData.synergies || [],
        projectOpportunities: analysisData.projectOpportunities || [],
        summary: analysisData.summary || {
          totalSynergies: analysisData.synergies?.length || 0,
          highPotentialSynergies: analysisData.synergies?.filter(s => s.potential === 'Élevé' || s.potential === 'Exceptionnel').length || 0,
          projectOpportunities: analysisData.projectOpportunities?.length || 0,
          analyzedMembers: statistics?.totalMembers || 0,
          aiEnhanced: statistics?.aiEnhanced || false,
          aiAnalysesCount: statistics?.aiEnhancedCount || 0,
          aiModel: statistics?.aiModel || null
        },
        timestamp: timestamp
      },
      
      insights: {
        totalSynergies: analysisData.synergies?.length || 0,
        highPotential: analysisData.synergies?.filter(s => s.potential === 'Élevé' || s.potential === 'Exceptionnel').length || 0,
        projectOpportunities: analysisData.projectOpportunities?.length || 0,
        analyzedMembers: statistics?.totalMembers || 0
      },
      
      suggestions: analysisData.synergies?.map(synergy => ({
        members: [synergy.member1?.name, synergy.member2?.name],
        score: synergy.score,
        potential: synergy.potential,
        reason: synergy.reason,
        recommendedActions: synergy.recommendedActions,
        type: synergy.type
      })) || [],
      
      dataSummary: {
        membersAnalyzed: statistics?.totalMembers || 0,
        projectsAnalyzed: statistics?.totalProjects || 0,
        skillsAnalyzed: statistics?.totalSkills || 0,
        specialtiesAnalyzed: statistics?.totalSpecialties || 0
      },
      
      statistics: {
        totalMembers: statistics?.totalMembers || 0,
        totalProjects: statistics?.totalProjects || 0,
        totalSkills: statistics?.totalSkills || 0,
        totalSpecialties: statistics?.totalSpecialties || 0,
        totalSynergies: analysisData.synergies?.length || 0,
        totalOpportunities: analysisData.projectOpportunities?.length || 0,
        aiEnhanced: statistics?.aiEnhanced || false,
        aiEnhancedCount: statistics?.aiEnhancedCount || 0,
        aiModel: statistics?.aiModel || null
      },
      
      aiEnhanced: statistics?.aiEnhanced || false,
      aiEnhancedCount: statistics?.aiEnhancedCount || 0,
      aiModel: statistics?.aiModel || null,
      
      analysisTimestamp: timestamp,
      status: 'completed'
    });

    const savedAnalysis = await newAnalysis.save();
    
    console.log(`✅ Analyse sauvegardée: ${savedAnalysis._id} - ${savedAnalysis.suggestions?.length || 0} synergies`);

    res.status(201).json({
      success: true,
      message: 'Analyse de synergies sauvegardée avec succès',
      data: savedAnalysis,
      analysisId: savedAnalysis._id
    });

  } catch (error) {
    console.error('💥 POST /api/v1/synergy-analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde de l\'analyse',
      error: isAppwrite ? 'Internal server error' : error.message
    });
  }
});

// GET - Récupérer toutes les analyses de synergies
synergyAnalysisRoutes.get('/', async (req, res) => {
  try {
    console.log('📥 GET /api/v1/synergy-analysis - Récupération analyses...');

    if (!Analysis) {
      return res.status(500).json({
        success: false,
        message: 'Analysis model not available'
      });
    }

    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const analyses = await Analysis.find({ 
      type: 'professional_synergy_analysis' 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Analysis.countDocuments({ 
      type: 'professional_synergy_analysis' 
    });

    console.log(`✅ ${analyses.length} analyses de synergies récupérées`);

    res.json({
      success: true,
      data: analyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('💥 GET /api/v1/synergy-analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses',
      error: isAppwrite ? 'Internal server error' : error.message
    });
  }
});

// GET - Récupérer une analyse spécifique
synergyAnalysisRoutes.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /api/v1/synergy-analysis/${id} - Récupération analyse...`);

    if (!Analysis) {
      return res.status(500).json({
        success: false,
        message: 'Analysis model not available'
      });
    }

    const analysis = await Analysis.findById(id);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error(`💥 GET /api/v1/synergy-analysis/${req.params.id} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'analyse',
      error: isAppwrite ? 'Internal server error' : error.message
    });
  }
});

// DELETE - Supprimer une analyse
synergyAnalysisRoutes.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ DELETE /api/v1/synergy-analysis/${id} - Suppression analyse...`);

    if (!Analysis) {
      return res.status(500).json({
        success: false,
        message: 'Analysis model not available'
      });
    }

    const deletedAnalysis = await Analysis.findByIdAndDelete(id);
    
    if (!deletedAnalysis) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Analyse supprimée avec succès',
      deletedId: deletedAnalysis._id
    });
  } catch (error) {
    console.error(`💥 DELETE /api/v1/synergy-analysis/${req.params.id} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: isAppwrite ? 'Internal server error' : error.message
    });
  }
});

// GET - Analyses récentes de synergies
synergyAnalysisRoutes.get('/recent/:limit?', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    console.log(`📥 GET /api/v1/synergy-analysis/recent/${limit} - Analyses récentes...`);

    if (!Analysis) {
      return res.status(500).json({
        success: false,
        message: 'Analysis model not available'
      });
    }

    const analyses = await Analysis.find({ 
      type: 'professional_synergy_analysis' 
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('title description insights statistics createdAt aiEnhanced aiEnhancedCount');

    res.json({
      success: true,
      data: analyses,
      total: analyses.length
    });
  } catch (error) {
    console.error('💥 GET /api/v1/synergy-analysis/recent error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses récentes',
      error: isAppwrite ? 'Internal server error' : error.message
    });
  }
});

// Utiliser les routes de synergies
app.use('/api/v1/synergy-analysis', synergyAnalysisRoutes);

// ==================== ROUTES DE DIAGNOSTIC ====================

// 🔹 ROUTE DE DIAGNOSTIC POUR VÉRIFIER LES COLLECTIONS
app.get('/api/v1/debug/collections', async (req, res) => {
  try {
    console.log('🔍 Debug: Vérification des collections...');
    
    // Liste de toutes les collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('📋 Collections disponibles:', collectionNames);
    
    // Compter les documents dans chaque collection
    const counts = {};
    
    for (const collectionName of collectionNames) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments();
        counts[collectionName] = count;
      } catch (err) {
        counts[collectionName] = `Error: ${err.message}`;
      }
    }
    
    // Vérifier les analyses de synergies spécifiquement
    let synergyAnalyses = [];
    if (collectionNames.includes('analyses')) {
      synergyAnalyses = await mongoose.connection.db.collection('analyses')
        .find({ type: 'professional_synergy_analysis' })
        .toArray();
    }

    res.json({
      success: true,
      collections: collectionNames,
      counts,
      synergyAnalyses: {
        total: synergyAnalyses.length,
        samples: synergyAnalyses.slice(0, 3)
      },
      models: {
        Member: !!Member,
        Project: !!Project,
        Group: !!Group,
        Interaction: !!Interaction,
        Skill: !!Skill,
        Specialty: !!Specialty,
        Analysis: !!Analysis
      },
      mongoose: {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      }
    });
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ROUTES EXISTANTES POUR NETLIFY ====================

// 🔹 Route pour récupérer les membres avec filtres et pagination
app.get('/api/v1/members/filter', async (req, res) => {
  try {
    if (!Member) {
      return res.status(500).json({ message: 'Member model not available' });
    }

    const { 
      page = 1, 
      limit = 12, 
      search, 
      specialty, 
      organization,
      location,
      sort = 'name'
    } = req.query;

    let query = {};
    
    // Filtre par recherche texte
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } },
        { specialties: { $in: [new RegExp(search, 'i')] } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Filtre par spécialité
    if (specialty) {
      query.specialties = { $in: [new RegExp(specialty, 'i')] };
    }

    // Filtre par organisation
    if (organization) {
      query.organization = { $regex: organization, $options: 'i' };
    }

    // Filtre par localisation
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    
    const members = await Member.find(query)
      .sort({ [sort]: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name title email organization specialties experienceYears photo location skills');

    const total = await Member.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      members,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMembers: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (err) {
    console.error('💥 GET /api/v1/members/filter error:', err);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des membres',
      error: err.message 
    });
  }
});

// 🔹 Route pour les détails d'un membre
app.get('/api/v1/members/:id', async (req, res) => {
  try {
    if (!Member) {
      return res.status(500).json({ message: 'Member model not available' });
    }

    const member = await Member.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ message: 'Membre non trouvé' });
    }

    res.json(member);
  } catch (err) {
    console.error('💥 GET /api/v1/members/:id error:', err);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération du membre',
      error: err.message 
    });
  }
});

// 🔹 Route pour les métadonnées (filtres)
app.get('/api/v1/metadata', async (req, res) => {
  try {
    if (!Member) {
      return res.status(500).json({ message: 'Member model not available' });
    }

    const specialties = await Member.distinct('specialties');
    const organizations = await Member.distinct('organization');
    const locations = await Member.distinct('location');

    // Nettoyer et trier les données
    const cleanData = (arr) => {
      if (!arr) return [];
      return arr
        .filter(item => item && item.trim() !== '')
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    };

    res.json({
      specialties: cleanData(specialties.flat()),
      organizations: cleanData(organizations),
      locations: cleanData(locations)
    });
  } catch (err) {
    console.error('💥 GET /api/v1/metadata error:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// 🔹 Route pour les statistiques détaillées du dashboard
app.get('/api/v1/dashboard/stats', async (req, res) => {
  try {
    if (!Member) {
      return res.status(500).json({ message: 'Member model not available' });
    }

    const totalMembers = await Member.countDocuments();
    
    // Compter par spécialités
    const specialtyStats = await Member.aggregate([
      { $unwind: '$specialties' },
      { $group: { _id: '$specialties', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Compter par organisations
    const organizationStats = await Member.aggregate([
      { $match: { organization: { $ne: '', $exists: true } } },
      { $group: { _id: '$organization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Compter par localisation
    const locationStats = await Member.aggregate([
      { $match: { location: { $ne: '', $exists: true } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Statistiques d'expérience
    const experienceStats = {
      junior: await Member.countDocuments({ experienceYears: { $lt: 5 } }),
      intermediate: await Member.countDocuments({ experienceYears: { $gte: 5, $lt: 10 } }),
      senior: await Member.countDocuments({ experienceYears: { $gte: 10 } })
    };

    res.json({
      totalMembers,
      specialtyStats,
      organizationStats,
      locationStats,
      experienceStats
    });

  } catch (err) {
    console.error('💥 GET /api/v1/dashboard/stats error:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// 🔹 Route de test CORS
app.get('/api/v1/test-cors', (req, res) => {
  res.json({ 
    success: true,
    message: 'CORS test réussi!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    frontend: 'https://resplendent-nasturtium-1fb598.netlify.app'
  });
});

// ==================== ROUTES EXISTANTES ====================

// 🔹 ROUTE DE SANTÉ
app.get('/_/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    platform: 'appwrite',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Backend fonctionnel sur Appwrite",
    platform: isAppwrite ? "appwrite" : "local",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    frontend: "https://resplendent-nasturtium-1fb598.netlify.app"
  });
});

// 🔹 ROUTES POUR LES GROUPES (existantes)
app.get('/api/v1/groups', async (req, res) => {
  try {
    if (!Group) {
      return res.status(500).json({ message: 'Group model not available' });
    }
    
    console.log("📥 GET /api/v1/groups request");
    const groups = await Group.find().populate('members', 'name email organization title');
    console.log(`✅ Found ${groups.length} groups`);
    
    const groupsWithCount = groups.map(group => ({
      ...group.toObject(),
      memberCount: group.members ? group.members.length : 0
    }));
    
    res.json({ groups: groupsWithCount });
  } catch (err) {
    console.error('💥 GET /api/v1/groups error:', err);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la récupération des groupes',
      error: isAppwrite ? 'Internal server error' : err.message 
    });
  }
});

app.get('/api/v1/groups/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    if (!Group) {
      return res.status(500).json({ message: 'Group model not available' });
    }

    console.log(`📥 GET /api/v1/groups/${id}/members request`);
    
    const group = await Group.findById(id).populate('members', 'name email organization title');
    if (!group) {
      return res.status(404).json({ message: 'Groupe introuvable' });
    }

    const byTitle = {};
    const byOrganization = {};

    group.members.forEach(member => {
      const title = member.title || "Sans titre";
      if (!byTitle[title]) byTitle[title] = [];
      byTitle[title].push({
        _id: member._id,
        name: member.name,
        email: member.email,
        organization: member.organization,
        title: member.title
      });

      const organization = member.organization || "Sans organisation";
      if (!byOrganization[organization]) byOrganization[organization] = [];
      byOrganization[organization].push({
        _id: member._id,
        name: member.name,
        email: member.email,
        organization: member.organization,
        title: member.title
      });
    });

    res.json({
      members: group.members,
      organizedMembers: { byTitle, byOrganization }
    });
  } catch (err) {
    console.error('💥 Erreur récupération membres:', err);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la récupération des membres',
      error: isAppwrite ? 'Internal server error' : err.message 
    });
  }
});

app.post('/api/v1/groups', async (req, res) => {
  try {
    if (!Group) {
      return res.status(500).json({ message: 'Group model not available' });
    }

    const { name, description, type, privacy, tags, members, leader } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ message: "Le nom et la description sont requis" });
    }

    const validTypes = ["technique", "sectoriel", "recherche", "management", "autre"];
    const validPrivacy = ["public", "private"];
    
    const group = new Group({
      name: name.trim(),
      description: description.trim(),
      type: validTypes.includes(type) ? type : "technique",
      privacy: validPrivacy.includes(privacy) ? privacy : "public",
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []),
      members: members || [],
      leader: leader || null
    });

    await group.save();
    
    const populatedGroup = await Group.findById(group._id).populate('members', 'name email organization title');
    
    res.status(201).json({
      ...populatedGroup.toObject(),
      memberCount: populatedGroup.members ? populatedGroup.members.length : 0
    });
  } catch (err) {
    console.error('💥 POST /api/v1/groups error:', err);
    res.status(500).json({ 
      message: "Erreur lors de la création du groupe",
      error: isAppwrite ? 'Internal server error' : err.message 
    });
  }
});

// 🔹 ROUTES DE SYNCHRONISATION
app.post('/api/v1/specialties/sync', async (req, res) => {
  try {
    if (!Specialty) {
      return res.status(500).json({ message: 'Specialty model not available' });
    }

    console.log("🔄 POST /api/v1/specialties/sync request");
    const { specialties } = req.body;

    if (!specialties || !Array.isArray(specialties)) {
      return res.status(400).json({ message: "Le tableau des spécialités est requis" });
    }

    const results = { created: 0, updated: 0, errors: [] };

    for (const specialtyData of specialties) {
      try {
        const { name, category, description, level } = specialtyData;
        
        if (!name) {
          results.errors.push(`Spécialité sans nom: ${JSON.stringify(specialtyData)}`);
          continue;
        }

        const existingSpecialty = await Specialty.findOne({ name });
        
        if (existingSpecialty) {
          await Specialty.findByIdAndUpdate(existingSpecialty._id, {
            category: category || existingSpecialty.category,
            description: description || existingSpecialty.description,
            level: level || existingSpecialty.level,
            updatedAt: new Date()
          });
          results.updated++;
        } else {
          await Specialty.create({
            name,
            category: category || "général",
            description: description || "",
            level: level || "intermédiaire"
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Erreur avec ${specialtyData.name}: ${error.message}`);
      }
    }

    console.log(`✅ Synchronisation spécialités: ${results.created} créées, ${results.updated} mises à jour`);
    
    res.json({
      success: true,
      message: `Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour`,
      ...results
    });

  } catch (err) {
    console.error('💥 POST /api/v1/specialties/sync error:', err);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la synchronisation des spécialités",
      error: isAppwrite ? 'Internal server error' : err.message 
    });
  }
});

// 🔹 ROUTE STATISTIQUES GLOBALES
app.get('/api/v1/stats', async (req, res) => {
  try {
    const stats = {
      totalMembers: await Member?.countDocuments() || 0,
      totalGroups: await Group?.countDocuments() || 0,
      totalProjects: await Project?.countDocuments() || 0,
      totalSkills: await Skill?.countDocuments() || 0,
      totalSpecialties: await Specialty?.countDocuments() || 0,
      totalAnalyses: await Analysis?.countDocuments() || 0,
      totalInteractions: await Interaction?.countDocuments() || 0,
    };

    res.json(stats);
  } catch (err) {
    console.error('💥 GET /api/v1/stats error:', err);
    res.status(500).json({ 
      message: "Erreur lors de la récupération des statistiques",
      error: isAppwrite ? 'Internal server error' : err.message 
    });
  }
});

// 🔹 FONCTION CRUD GÉNÉRIQUE
const createCrudRoutes = (model, routeName) => {
  const router = express.Router();

  if (!model) {
    console.warn(`⚠️ Model ${routeName} not available, CRUD routes disabled`);
    return router;
  }

  // GET all
  router.get('/', async (req, res) => {
    try {
      const { limit, sort } = req.query;
      let query = model.find();

      if (sort) {
        const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
        const sortDirection = sort.startsWith('-') ? -1 : 1;
        query = query.sort({ [sortField]: sortDirection });
      }

      if (limit) {
        query = query.limit(parseInt(limit, 10));
      }

      const items = await query.exec();
      res.json(items);
    } catch (err) {
      console.error(`💥 GET /api/v1/${routeName.toLowerCase()} error:`, err);
      res.status(500).json({ 
        message: err.message,
        error: isAppwrite ? 'Internal server error' : err.message 
      });
    }
  });

  // GET by id
  router.get('/:id', async (req, res) => {
    try {
      const item = await model.findById(req.params.id);
      if (!item) return res.status(404).json({ message: `${routeName} not found` });
      res.json(item);
    } catch (err) {
      console.error(`💥 GET /api/v1/${routeName.toLowerCase()}/:id error:`, err);
      res.status(500).json({ 
        message: err.message,
        error: isAppwrite ? 'Internal server error' : err.message 
      });
    }
  });

  // POST create
  router.post('/', async (req, res) => {
    try {
      const newItem = new model(req.body);
      await newItem.save();
      res.status(201).json(newItem);
    } catch (err) {
      console.error(`💥 POST /api/v1/${routeName.toLowerCase()} error:`, err);
      res.status(400).json({ 
        message: err.message,
        error: isAppwrite ? 'Bad request' : err.message 
      });
    }
  });

  // PUT update
  router.put('/:id', async (req, res) => {
    try {
      const updatedItem = await model.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedItem) return res.status(404).json({ message: `${routeName} not found` });
      res.json(updatedItem);
    } catch (err) {
      console.error(`💥 PUT /api/v1/${routeName.toLowerCase()}/:id error:`, err);
      res.status(400).json({ 
        message: err.message,
        error: isAppwrite ? 'Bad request' : err.message 
      });
    }
  });

  // DELETE
  router.delete('/:id', async (req, res) => {
    try {
      const deletedItem = await model.findByIdAndDelete(req.params.id);
      if (!deletedItem) return res.status(404).json({ message: `${routeName} not found` });
      res.json({ message: `${routeName} deleted` });
    } catch (err) {
      console.error(`💥 DELETE /api/v1/${routeName.toLowerCase()}/:id error:`, err);
      res.status(500).json({ 
        message: err.message,
        error: isAppwrite ? 'Internal server error' : err.message 
      });
    }
  });

  return router;
};

// 🔹 ROUTES SPÉCIFIQUES POUR LES ANALYSES IA
app.delete('/api/v1/analyses/cleanup', async (req, res) => {
  try {
    if (!Analysis) {
      return res.status(500).json({ message: 'Analysis model not available' });
    }

    const { type, keep } = req.query;
    const keepCount = parseInt(keep, 10) || 5; 
    const query = type ? { type } : {};

    console.log(`🗑️ DELETE /api/v1/analyses/cleanup: Type=${type || 'All'}, Keep=${keepCount}`);

    const analysesToKeep = await Analysis.find(query)
      .sort({ createdAt: -1 })
      .limit(keepCount)
      .select('_id');

    const idsToKeep = analysesToKeep.map(a => a._id);

    const deleteResult = await Analysis.deleteMany({
      ...query,
      _id: { $nin: idsToKeep }
    });

    console.log(`✅ Nettoyage terminé: ${deleteResult.deletedCount} analyses supprimées.`);

    res.json({
      success: true,
      message: `${deleteResult.deletedCount} analyses nettoyées (gardant les ${keepCount} plus récentes du type ${type || 'tous'}).`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (err) {
    console.error('💥 DELETE /api/v1/analyses/cleanup error:', err);
    res.status(500).json({
      success: false,
      message: "Erreur lors du nettoyage des analyses",
      error: isAppwrite ? 'Internal server error' : err.message
    });
  }
});

// 🔹 Routes CRUD pour les autres entités
app.use('/api/v1/members', createCrudRoutes(Member, 'Member'));
app.use('/api/v1/projects', createCrudRoutes(Project, 'Project'));
app.use('/api/v1/groups', createCrudRoutes(Group, 'Group'));
app.use('/api/v1/interactions', createCrudRoutes(Interaction, 'Interaction'));
app.use('/api/v1/specialties', createCrudRoutes(Specialty, 'Specialty'));
app.use('/api/v1/analyses', createCrudRoutes(Analysis, 'Analysis'));

// Route racine
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Matrice Profils - Déployé sur Appwrite',
    version: '1.0.0',
    platform: isAppwrite ? 'appwrite' : 'local',
    timestamp: new Date().toISOString(),
    frontend: 'https://resplendent-nasturtium-1fb598.netlify.app',
    endpoints: {
      health: '/api/v1/health',
      stats: '/api/v1/stats',
      dashboard: '/api/v1/dashboard/stats',
      metadata: '/api/v1/metadata',
      members: '/api/v1/members/filter',
      groups: '/api/v1/groups',
      projects: '/api/v1/projects',
      skills: '/api/v1/skills',
      specialties: '/api/v1/specialties',
      analyses: '/api/v1/analyses',
      interactions: '/api/v1/interactions',
      // NOUVEAUX ENDPOINTS
      synergyAnalysis: '/api/v1/synergy-analysis',
      allMatrixData: '/api/v1/all-data/matrix-data',
      executeFunction: '/api/v1/execute-function',
      debug: '/api/v1/debug/collections',
      // EXISTANTS
      specialtiesSync: '/api/v1/specialties/sync',
      testCors: '/api/v1/test-cors'
    }
  });
});

// Middleware 404
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route non trouvée',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      '/api/v1/health',
      '/api/v1/stats',
      '/api/v1/dashboard/stats',
      '/api/v1/metadata',
      '/api/v1/members/filter',
      '/api/v1/groups',
      '/api/v1/synergy-analysis',
      '/api/v1/all-data/matrix-data',
      '/api/v1/execute-function',
      '/api/v1/debug/collections',
      '/api/v1/test-cors',
      '/api/v1/analyses',
      '/api/v1/interactions'
    ]
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('💥 Global error handler:', err.stack);
  res.status(500).json({ 
    message: 'Internal Server Error',
    error: isAppwrite ? 'Something went wrong!' : err.message
  });
});

// Démarrage serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API started on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏗️ Platform: ${isAppwrite ? 'Appwrite' : 'Local'}`);
  console.log(`🌐 Frontend: https://resplendent-nasturtium-1fb598.netlify.app`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/api/v1/health`);
  console.log(`🔍 CORS test: http://0.0.0.0:${PORT}/api/v1/test-cors`);
  console.log(`🎯 Synergy analysis: http://0.0.0.0:${PORT}/api/v1/synergy-analysis`);
  console.log(`📦 All matrix data: http://0.0.0.0:${PORT}/api/v1/all-data/matrix-data`);
  console.log(`⚡ Execute function: http://0.0.0.0:${PORT}/api/v1/execute-function`);
  console.log(`🔧 Debug: http://0.0.0.0:${PORT}/api/v1/debug/collections`);
  console.log(`📊 Analyses: http://0.0.0.0:${PORT}/api/v1/analyses`);
  console.log(`💬 Interactions: http://0.0.0.0:${PORT}/api/v1/interactions`);
  
  if (isAppwrite) {
    console.log('✅ Successfully deployed on Appwrite');
  }
});

module.exports = app;
