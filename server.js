// server.js - VERSION COMPLÈTEMENT MISE À JOUR POUR APPWRITE + NETLIFY
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

// ==================== NOUVELLES ROUTES POUR NETLIFY ====================

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

// 🔹 IMPORT DES ROUTES SKILLS SPÉCIFIQUES
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
      '/api/v1/test-cors'
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
  
  if (isAppwrite) {
    console.log('✅ Successfully deployed on Appwrite');
  }
});

module.exports = app;
