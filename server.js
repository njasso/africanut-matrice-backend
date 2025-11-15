// server.js - VERSION COMPLÈTE CORRIGÉE AVEC TOUTES LES ROUTES DE SYNCHRONISATION
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connexion à MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/matrice';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import des modèles
const Member = require('./models/Member');
const Project = require('./models/Project');
const Group = require('./models/Group');
const Interaction = require('./models/Interaction');
const Skill = require('./models/Skill');
const Specialty = require('./models/Specialty');
const Analysis = require('./models/Analysis'); // 💡 NOUVEAU MODÈLE - Assurez-vous d'avoir ce fichier

// 🔹 ROUTES SPÉCIFIQUES POUR LES GROUPES AVEC REGROUPEMENT

// 🔹 Route pour récupérer tous les groupes avec populate
app.get('/api/v1/groups', async (req, res) => {
  try {
    console.log("📥 GET /api/v1/groups request");
    const groups = await Group.find().populate('members', 'name email organization title');
    console.log(`✅ Found ${groups.length} groups`);
    
    // Ajouter le comptage des membres pour chaque groupe
    const groupsWithCount = groups.map(group => ({
      ...group.toObject(),
      memberCount: group.members ? group.members.length : 0
    }));
    
    res.json({ groups: groupsWithCount });
  } catch (err) {
    console.error('💥 GET /api/v1/groups error:', err);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la récupération des groupes',
      error: err.message 
    });
  }
});

// 🔹 Route améliorée pour récupérer les membres d'un groupe AVEC REGROUPEMENT
app.get('/api/v1/groups/:id/members', async (req, res) => {
  const { id } = req.params;
  try {
    console.log(`📥 GET /api/v1/groups/${id}/members request`);
    
    const group = await Group.findById(id).populate('members', 'name email organization title');
    if (!group) {
      return res.status(404).json({ message: 'Groupe introuvable' });
    }

    // Organisation des membres par titre et organisation
    const byTitle = {};
    const byOrganization = {};

    group.members.forEach(member => {
      // Regroupement par titre
      const title = member.title || "Sans titre";
      if (!byTitle[title]) {
        byTitle[title] = [];
      }
      byTitle[title].push({
        _id: member._id,
        name: member.name,
        email: member.email,
        organization: member.organization,
        title: member.title
      });

      // Regroupement par organisation
      const organization = member.organization || "Sans organisation";
      if (!byOrganization[organization]) {
        byOrganization[organization] = [];
      }
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
      organizedMembers: {
        byTitle,
        byOrganization
      }
    });
  } catch (err) {
    console.error('💥 Erreur récupération membres:', err);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la récupération des membres',
      error: err.message 
    });
  }
});

// 🔹 Route pour créer un groupe avec validation améliorée
app.post('/api/v1/groups', async (req, res) => {
  try {
    const { name, description, type, privacy, tags, members, leader } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ message: "Le nom et la description sont requis" });
    }

    // Validation du type
    const validTypes = ["technique", "sectoriel", "recherche", "management", "autre"];
    const groupType = validTypes.includes(type) ? type : "technique";

    // Validation de la confidentialité
    const validPrivacy = ["public", "private"];
    const groupPrivacy = validPrivacy.includes(privacy) ? privacy : "public";

    // Traitement des tags
    let processedTags = [];
    if (Array.isArray(tags)) {
      processedTags = tags;
    } else if (typeof tags === 'string') {
      processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    const group = new Group({
      name: name.trim(),
      description: description.trim(),
      type: groupType,
      privacy: groupPrivacy,
      tags: processedTags,
      members: members || [],
      leader: leader || null
    });

    await group.save();
    
    // Retourner le groupe avec les membres populés
    const populatedGroup = await Group.findById(group._id).populate('members', 'name email organization title');
    
    res.status(201).json({
      ...populatedGroup.toObject(),
      memberCount: populatedGroup.members ? populatedGroup.members.length : 0
    });
  } catch (err) {
    console.error('💥 POST /api/v1/groups error:', err);
    res.status(500).json({ 
      message: err.message || "Erreur lors de la création du groupe",
      error: err.message 
    });
  }
});

// 🔹 Route pour ajouter des membres à un groupe
app.post('/api/v1/groups/:id/members', async (req, res) => {
  const { id } = req.params;
  const { memberIds } = req.body;
  
  try {
    if (!memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ message: "Les IDs des membres sont requis sous forme de tableau" });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: "Groupe introuvable" });
    }

    // Vérifier l'existence des membres
    const existingMembers = await Member.find({ _id: { $in: memberIds } });
    if (existingMembers.length !== memberIds.length) {
      return res.status(404).json({ message: "Certains membres n'existent pas" });
    }

    // Ajouter les membres (éviter les doublons)
    const newMembers = [...new Set([...group.members.map(m => m.toString()), ...memberIds])];
    group.members = newMembers;
    
    await group.save();

    const updatedGroup = await Group.findById(id).populate('members', 'name email organization title');
    
    res.json({
      ...updatedGroup.toObject(),
      memberCount: updatedGroup.members ? updatedGroup.members.length : 0
    });
  } catch (err) {
    console.error('💥 POST /api/v1/groups/:id/members error:', err);
    res.status(500).json({ 
      message: "Erreur lors de l'ajout des membres au groupe",
      error: err.message 
    });
  }
});

// 🔹 Route pour supprimer un membre d'un groupe
app.delete('/api/v1/groups/:groupId/members/:memberId', async (req, res) => {
  const { groupId, memberId } = req.params;
  
  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Groupe introuvable" });
    }

    // Retirer le membre
    group.members = group.members.filter(m => m.toString() !== memberId);
    await group.save();

    const updatedGroup = await Group.findById(groupId).populate('members', 'name email organization title');
    
    res.json({
      ...updatedGroup.toObject(),
      memberCount: updatedGroup.members ? updatedGroup.members.length : 0
    });
  } catch (err) {
    console.error('💥 DELETE /api/v1/groups/:groupId/members/:memberId error:', err);
    res.status(500).json({ 
      message: "Erreur lors de la suppression du membre du groupe",
      error: err.message 
    });
  }
});

// 🔹 Route pour réorganiser les membres d'un groupe
app.post('/api/v1/groups/:id/organize-members', async (req, res) => {
  const { id } = req.params;
  
  try {
    const group = await Group.findById(id).populate('members', 'name email organization title');
    if (!group) {
      return res.status(404).json({ message: "Groupe introuvable" });
    }

    // Organisation des membres par titre et organisation
    const byTitle = {};
    const byOrganization = {};

    group.members.forEach(member => {
      // Regroupement par titre
      const title = member.title || "Sans titre";
      if (!byTitle[title]) {
        byTitle[title] = [];
      }
      byTitle[title].push({
        _id: member._id,
        name: member.name,
        email: member.email,
        organization: member.organization,
        title: member.title
      });

      // Regroupement par organisation
      const organization = member.organization || "Sans organisation";
      if (!byOrganization[organization]) {
        byOrganization[organization] = [];
      }
      byOrganization[organization].push({
        _id: member._id,
        name: member.name,
        email: member.email,
        organization: member.organization,
        title: member.title
      });
    });

    res.json({
      success: true,
      organizedMembers: {
        byTitle,
        byOrganization
      }
    });
  } catch (err) {
    console.error('💥 POST /api/v1/groups/:id/organize-members error:', err);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de l'organisation des membres",
      error: err.message 
    });
  }
});

// 🔹 ROUTES DE SYNCHRONISATION POUR LES SPÉCIALITÉS

// 🔹 Route de synchronisation pour les spécialités
app.post('/api/v1/specialties/sync', async (req, res) => {
  try {
    console.log("🔄 POST /api/v1/specialties/sync request");
    const { specialties } = req.body;

    if (!specialties || !Array.isArray(specialties)) {
      return res.status(400).json({ 
        message: "Le tableau des spécialités est requis" 
      });
    }

    // Synchronisation des spécialités
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const specialtyData of specialties) {
      try {
        const { name, category, description, level } = specialtyData;
        
        if (!name) {
          results.errors.push(`Spécialité sans nom: ${JSON.stringify(specialtyData)}`);
          continue;
        }

        // Recherche existante ou création
        const existingSpecialty = await Specialty.findOne({ name });
        
        if (existingSpecialty) {
          // Mise à jour
          await Specialty.findByIdAndUpdate(existingSpecialty._id, {
            category: category || existingSpecialty.category,
            description: description || existingSpecialty.description,
            level: level || existingSpecialty.level,
            updatedAt: new Date()
          });
          results.updated++;
        } else {
          // Création
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
      error: err.message 
    });
  }
});

// 🔹 Route pour synchroniser les spécialités depuis un fichier prédéfini
app.post('/api/v1/specialties/sync-from-default', async (req, res) => {
  try {
    console.log("🔄 POST /api/v1/specialties/sync-from-default request");
    
    // Spécialités par défaut
    const defaultSpecialties = [
      { name: "JavaScript", category: "développement", level: "avancé" },
      { name: "React", category: "développement", level: "intermédiaire" },
      { name: "Node.js", category: "développement", level: "avancé" },
      { name: "MongoDB", category: "base de données", level: "intermédiaire" },
      { name: "UI/UX Design", category: "design", level: "intermédiaire" },
      { name: "Gestion de projet", category: "management", level: "avancé" },
      { name: "DevOps", category: "infrastructure", level: "débutant" },
      { name: "Python", category: "développement", level: "intermédiaire" },
      { name: "Data Science", category: "analyse", level: "avancé" },
      { name: "Cybersécurité", category: "sécurité", level: "intermédiaire" }
    ];

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const specialtyData of defaultSpecialties) {
      try {
        const existingSpecialty = await Specialty.findOne({ name: specialtyData.name });
        
        if (existingSpecialty) {
          await Specialty.findByIdAndUpdate(existingSpecialty._id, {
            ...specialtyData,
            updatedAt: new Date()
          });
          results.updated++;
        } else {
          await Specialty.create(specialtyData);
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Erreur avec ${specialtyData.name}: ${error.message}`);
      }
    }

    console.log(`✅ Synchronisation spécialités par défaut: ${results.created} créées, ${results.updated} mises à jour`);
    
    res.json({
      success: true,
      message: `Synchronisation des spécialités par défaut terminée: ${results.created} créées, ${results.updated} mises à jour`,
      ...results
    });

  } catch (err) {
    console.error('💥 POST /api/v1/specialties/sync-from-default error:', err);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la synchronisation des spécialités par défaut",
      error: err.message 
    });
  }
});

// 🔹 Route pour vider et réinitialiser les spécialités
app.post('/api/v1/specialties/reset', async (req, res) => {
  try {
    console.log("🔄 POST /api/v1/specialties/reset request");
    
    // Supprimer toutes les spécialités existantes
    const deleteResult = await Specialty.deleteMany({});
    
    // Recréer les spécialités par défaut
    const defaultSpecialties = [
      { name: "JavaScript", category: "développement", level: "avancé", description: "Langage de programmation pour le web" },
      { name: "React", category: "développement", level: "intermédiaire", description: "Bibliothèque JavaScript pour interfaces utilisateur" },
      { name: "Node.js", category: "développement", level: "avancé", description: "Environnement d'exécution JavaScript côté serveur" },
      { name: "MongoDB", category: "base de données", level: "intermédiaire", description: "Base de données NoSQL" },
      { name: "UI/UX Design", category: "design", level: "intermédiaire", description: "Conception d'interfaces utilisateur et d'expérience" },
      { name: "Gestion de projet", category: "management", level: "avancé", description: "Planification et gestion de projets" },
      { name: "DevOps", category: "infrastructure", level: "débutant", description: "Pratiques de développement et d'opérations" }
    ];

    const createdSpecialties = await Specialty.insertMany(defaultSpecialties);

    res.json({
      success: true,
      message: `Spécialités réinitialisées: ${deleteResult.deletedCount} supprimées, ${createdSpecialties.length} créées`,
      deletedCount: deleteResult.deletedCount,
      createdCount: createdSpecialties.length,
      specialties: createdSpecialties
    });

  } catch (err) {
    console.error('💥 POST /api/v1/specialties/reset error:', err);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la réinitialisation des spécialités",
      error: err.message 
    });
  }
});

// 🔹 Route de santé pour tester la connexion
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Backend fonctionnel",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// 🔹 Route pour les statistiques
app.get('/api/v1/stats', async (req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const totalGroups = await Group.countDocuments();
    const totalProjects = await Project.countDocuments();
    const totalSkills = await Skill.countDocuments();
    const totalSpecialties = await Specialty.countDocuments();
    
    // Compter les membres par organisation
    const membersByOrganization = await Member.aggregate([
      {
        $group: {
          _id: '$organization',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Compter les groupes par type
    const groupsByType = await Group.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Compter les compétences par catégorie
    const skillsByCategory = await Skill.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Compter les spécialités par catégorie
    const specialtiesByCategory = await Specialty.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalMembers,
      totalGroups,
      totalProjects,
      totalSkills,
      totalSpecialties,
      membersByOrganization,
      groupsByType,
      skillsByCategory,
      specialtiesByCategory
    });
  } catch (err) {
    console.error('💥 GET /api/v1/stats error:', err);
    res.status(500).json({ 
      message: "Erreur lors de la récupération des statistiques",
      error: err.message 
    });
  }
});

// 🔹 FONCTION CRUD GÉNÉRIQUE (conservée pour compatibilité)
const createCrudRoutes = (model, routeName) => {
  const router = express.Router();

  // GET all
  router.get('/', async (req, res) => {
    try {
      // Pour les analyses, on gère les options de tri/limite pour le front-end
      const { limit, sort } = req.query;
      let query = model.find();

      if (sort) {
          // Exemple: sort=-createdAt => { createdAt: -1 }
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
      res.status(500).json({ message: err.message });
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
      res.status(500).json({ message: err.message });
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
      res.status(400).json({ message: err.message });
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
      res.status(400).json({ message: err.message });
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
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};

// 🔹 ROUTES SPÉCIFIQUES POUR LES ANALYSES IA

// 💡 NOUVELLE ROUTE : Endpoint de nettoyage spécifique (/analyses/cleanup)
app.delete('/api/v1/analyses/cleanup', async (req, res) => {
  try {
    const { type, keep } = req.query; // Récupère 'type=interaction_analysis' et 'keep=3' du front-end
    const keepCount = parseInt(keep, 10) || 5; 
    const query = type ? { type } : {}; // Filtre par type si spécifié

    console.log(`🗑️ DELETE /api/v1/analyses/cleanup: Type=${type || 'All'}, Keep=${keepCount}`);

    // 1. Trouver les IDs des documents à conserver (les plus récents)
    // On assume que votre modèle 'Analysis' a un champ 'createdAt'
    const analysesToKeep = await Analysis.find(query)
      .sort({ createdAt: -1 })
      .limit(keepCount)
      .select('_id');

    const idsToKeep = analysesToKeep.map(a => a._id);

    // 2. Supprimer tous les documents qui NE SONT PAS dans la liste des IDs à conserver
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
      error: err.message
    });
  }
});


// 🔹 Routes CRUD pour les autres entités
app.use('/api/v1/members', createCrudRoutes(Member, 'Member'));
app.use('/api/v1/projects', createCrudRoutes(Project, 'Project'));
app.use('/api/v1/groups', createCrudRoutes(Group, 'Group')); // Conserver pour compatibilité
app.use('/api/v1/interactions', createCrudRoutes(Interaction, 'Interaction'));
app.use('/api/v1/specialties', createCrudRoutes(Specialty, 'Specialty'));
app.use('/api/v1/analyses', createCrudRoutes(Analysis, 'Analysis')); // 💡 NOUVELLE ROUTE : Ajout du CRUD pour les analyses

// 🔹 IMPORT DES ROUTES SKILLS SPÉCIFIQUES (avec sync)
app.use('/api/v1/skills', require('./routes/skills'));

// Route racine
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Matrice Profils - Serveur fonctionnel',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      stats: '/api/v1/stats',
      groups: '/api/v1/groups',
      members: '/api/v1/members',
      projects: '/api/v1/projects',
      skills: '/api/v1/skills',
      specialties: '/api/v1/specialties',
      analyses: '/api/v1/analyses', // 💡 MISE À JOUR DOCUMENTATION
      analysesCleanup: '/api/v1/analyses/cleanup', // 💡 MISE À JOUR DOCUMENTATION
      specialtiesSync: '/api/v1/specialties/sync',
      specialtiesSyncDefault: '/api/v1/specialties/sync-from-default',
      specialtiesReset: '/api/v1/specialties/reset',
      skillsSync: '/api/v1/skills/sync'
    },
    timestamp: new Date().toISOString()
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
      '/api/v1/members',
      '/api/v1/analyses', // 💡 MISE À JOUR DOCUMENTATION
      '/api/v1/specialties/sync',
      '/api/v1/specialties/sync-from-default'
    ]
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('💥 Global error handler:', err.stack);
  res.status(500).json({ 
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// Démarrage serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API started on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
  console.log(`👥 Groups API: http://localhost:${PORT}/api/v1/groups`);
  console.log(`🔧 Skills API: http://localhost:${PORT}/api/v1/skills`);
  console.log(`🎯 Specialties API: http://localhost:${PORT}/api/v1/specialties`);
  console.log(`💡 Analyses API: http://localhost:${PORT}/api/v1/analyses`); // 💡 MISE À JOUR CONSOLE
  console.log(`🔄 Specialties Sync: http://localhost:${PORT}/api/v1/specialties/sync`);
  console.log(`🔄 Specialties Default Sync: http://localhost:${PORT}/api/v1/specialties/sync-from-default`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});