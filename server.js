// server.js - VERSION OPTIMISÉE POUR APPWRITE
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// 🔹 CONFIGURATION SPÉCIFIQUE APPWRITE
const isAppwrite = process.env.APPWRITE_FUNCTION_ID !== undefined;
const PORT = process.env.PORT || 3000; // Appwrite utilise le port 3000

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // En production Appwrite, autoriser toutes les origines ou configurer spécifiquement
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging adapté pour Appwrite
if (isAppwrite) {
  app.use(morgan('combined')); // Logs structurés pour le cloud
} else {
  app.use(morgan('dev')); // Logs détaillés en développement
}

// 🔹 CONNEXION MONGODB OPTIMISÉE POUR APPWRITE
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('❌ MONGO_URI is required');
  process.exit(1);
}

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout réduit pour serverless
  socketTimeoutMS: 45000, // Timeout socket
  maxPoolSize: 10, // Pool de connexions réduit
  minPoolSize: 1,
};

mongoose.connect(mongoURI, mongooseOptions)
  .then(() => console.log('✅ MongoDB connected to Appwrite'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    // En production, on ne quitte pas le processus pour éviter les restarts boucles
    if (!isAppwrite) process.exit(1);
  });

// Gestion gracieuse de la fermeture (important pour serverless)
process.on('SIGTERM', async () => {
  console.log('🔻 SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

// Import des modèles avec gestion d'erreur
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
  // En production, on continue sans les modèles manquants
}

// 🔹 ROUTE DE SANTÉ SPÉCIFIQUE APPWRITE
app.get('/_/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    platform: 'appwrite',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 🔹 ROUTES SPÉCIFIQUES POUR LES GROUPES AVEC REGROUPEMENT
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

// 🔹 Route améliorée pour récupérer les membres d'un groupe
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

// 🔹 Route pour créer un groupe avec validation améliorée
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

// 🔹 ROUTES DE SYNCHRONISATION POUR LES SPÉCIALITÉS
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

// 🔹 Route de santé pour tester la connexion
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Backend fonctionnel sur Appwrite",
    platform: isAppwrite ? "appwrite" : "local",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// 🔹 Route pour les statistiques
app.get('/api/v1/stats', async (req, res) => {
  try {
    const stats = {
      totalMembers: await Member?.countDocuments() || 0,
      totalGroups: await Group?.countDocuments() || 0,
      totalProjects: await Project?.countDocuments() || 0,
      totalSkills: await Skill?.countDocuments() || 0,
      totalSpecialties: await Specialty?.countDocuments() || 0,
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

// 🔹 FONCTION CRUD GÉNÉRIQUE OPTIMISÉE
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

// 🔹 IMPORT DES ROUTES SKILLS SPÉCIFIQUES (avec gestion d'erreur)
try {
  app.use('/api/v1/skills', require('./routes/skills'));
  console.log('✅ Skills routes loaded');
} catch (error) {
  console.warn('⚠️ Skills routes not available:', error.message);
}

// Route racine
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Matrice Profils - Déployé sur Appwrite',
    version: '1.0.0',
    platform: isAppwrite ? 'appwrite' : 'local',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/v1/health',
      stats: '/api/v1/stats',
      groups: '/api/v1/groups',
      members: '/api/v1/members',
      projects: '/api/v1/projects',
      skills: '/api/v1/skills',
      specialties: '/api/v1/specialties',
      analyses: '/api/v1/analyses',
      specialtiesSync: '/api/v1/specialties/sync'
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
      '/api/v1/groups',
      '/api/v1/members'
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
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/api/v1/health`);
  
  if (isAppwrite) {
    console.log('✅ Successfully deployed on Appwrite');
  }
});

module.exports = app; // Export pour les tests
