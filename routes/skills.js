// routes/skills.js - VERSION CONFIGURÉE ET OPTIMISÉE
const express = require('express');
const router = express.Router();
const Skill = require('../models/Skill');
const Member = require('../models/Member');

// Configuration
const SKILLS_CONFIG = {
  defaultLimit: 100,
  maxLimit: 500,
  sortFields: ['name', 'memberCount', 'popularity', 'category', 'createdAt', 'updatedAt'],
  defaultSort: '-memberCount',
  categories: {
    langage: ['javascript', 'python', 'java', 'typescript', 'php', 'ruby', 'go', 'c#', 'c++', 'swift', 'html', 'css', 'sql'],
    technique: ['react', 'angular', 'vue', 'node', 'express', 'django', 'spring', 'docker', 'kubernetes', 'mongodb', 'mysql', 'postgresql'],
    design: ['ui', 'ux', 'design', 'figma', 'photoshop', 'illustrator', 'sketch'],
    outil: ['git', 'jenkins', 'vscode', 'postman', 'jira', 'trello', 'slack'],
    management: ['gestion', 'management', 'leadership', 'projet', 'équipe', 'agile', 'scrum', 'kanban'],
    soft: ['communication', 'créativité', 'adaptabilité', 'résolution', 'empathie', 'collaboration', 'travail d\'équipe'],
    domaine: ['finance', 'marketing', 'rh', 'juridique', 'commercial', 'santé', 'éducation']
  }
};

// Middleware de validation des paramètres de requête
const validateQueryParams = (req, res, next) => {
  const { limit, sort, category, search } = req.query;
  
  // Validation de la limite
  if (limit && (isNaN(limit) || parseInt(limit) <= 0)) {
    return res.status(400).json({
      success: false,
      message: `Le paramètre 'limit' doit être un nombre positif`
    });
  }
  
  // Validation du tri
  if (sort && !isValidSortField(sort)) {
    return res.status(400).json({
      success: false,
      message: `Le champ de tri '${sort}' n'est pas valide. Champs disponibles: ${SKILLS_CONFIG.sortFields.join(', ')}`
    });
  }
  
  next();
};

// GET /api/v1/skills - Récupérer toutes les compétences avec filtres
router.get('/', validateQueryParams, async (req, res) => {
  try {
    const { 
      limit = SKILLS_CONFIG.defaultLimit, 
      sort = SKILLS_CONFIG.defaultSort,
      category,
      search
    } = req.query;
    
    console.log(`🛠️ GET /api/v1/skills request - limit: ${limit}, sort: ${sort}, category: ${category}, search: ${search}`);
    
    // Construction de la requête
    const query = {};
    
    // Filtre par catégorie
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Filtre par recherche textuelle
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const actualLimit = Math.min(parseInt(limit), SKILLS_CONFIG.maxLimit);
    
    const skills = await Skill.find(query)
      .sort(sort)
      .limit(actualLimit)
      .lean();

    // Statistiques supplémentaires
    const totalSkills = await Skill.countDocuments();
    const categoriesStats = await Skill.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: skills,
      pagination: {
        limit: actualLimit,
        total: skills.length,
        totalSkills
      },
      filters: {
        categories: categoriesStats,
        availableCategories: Object.keys(SKILLS_CONFIG.categories)
      }
    });
  } catch (err) {
    console.error('💥 GET /api/v1/skills error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des compétences',
      error: err.message 
    });
  }
});

// GET /api/v1/skills/stats - Statistiques des compétences
router.get('/stats/overview', async (req, res) => {
  try {
    console.log('📊 GET /api/v1/skills/stats request');
    
    const totalSkills = await Skill.countDocuments();
    const totalMembersWithSkills = await Member.countDocuments({ 
      skills: { $exists: true, $not: { $size: 0 } } 
    });
    
    const popularSkills = await Skill.find()
      .sort({ memberCount: -1 })
      .limit(5)
      .select('name memberCount popularity')
      .lean();
      
    const categoriesStats = await Skill.aggregate([
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 },
          totalMembers: { $sum: '$memberCount' }
        } 
      },
      { $sort: { count: -1 } }
    ]);
    
    const recentSkills = await Skill.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name createdAt category')
      .lean();

    res.json({
      success: true,
      data: {
        totalSkills,
        totalMembersWithSkills,
        popularSkills,
        categories: categoriesStats,
        recentSkills,
        averagePopularity: popularSkills.reduce((acc, skill) => acc + skill.popularity, 0) / popularSkills.length
      }
    });
  } catch (err) {
    console.error('💥 GET /api/v1/skills/stats error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: err.message 
    });
  }
});

// POST /api/v1/skills/sync - Synchroniser les compétences avec les membres
router.post('/sync', async (req, res) => {
  try {
    console.log("🔄 POST /api/v1/skills/sync request");
    
    const members = await Member.find();
    const skillMap = new Map();

    console.log(`📊 Analyse de ${members.length} membres...`);

    // Extraire les compétences des membres
    members.forEach(member => {
      if (member.skills && Array.isArray(member.skills)) {
        member.skills.forEach(skillName => {
          if (skillName && typeof skillName === 'string' && skillName.trim()) {
            const name = skillName.trim().toLowerCase();
            const formattedName = formatSkillName(skillName.trim());
            
            if (!skillMap.has(name)) {
              skillMap.set(name, {
                name: formattedName,
                originalName: skillName.trim(),
                memberCount: 0,
                category: categorizeSkill(name)
              });
            }
            skillMap.get(name).memberCount++;
          }
        });
      }
    });

    console.log(`🎯 ${skillMap.size} compétences uniques trouvées`);

    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
      skipped: 0
    };

    // Synchroniser avec la base de données
    for (const [key, data] of skillMap) {
      try {
        // Ignorer les compétences vides ou trop courtes
        if (data.name.length < 2) {
          results.skipped++;
          continue;
        }

        const existingSkill = await Skill.findOne({ 
          name: { $regex: new RegExp(`^${data.name}$`, 'i') } 
        });

        if (existingSkill) {
          await Skill.findByIdAndUpdate(
            existingSkill._id,
            {
              name: data.name,
              category: data.category,
              memberCount: data.memberCount,
              popularity: members.length > 0 ? (data.memberCount / members.length) * 100 : 0,
              updatedAt: new Date()
            }
          );
          results.updated++;
        } else {
          await Skill.create({
            name: data.name,
            category: data.category,
            memberCount: data.memberCount,
            popularity: members.length > 0 ? (data.memberCount / members.length) * 100 : 0,
            description: generateSkillDescription(data.name, data.category)
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Erreur avec ${data.name}: ${error.message}`);
        console.error(`❌ Erreur avec ${data.name}:`, error.message);
      }
    }

    const skills = await Skill.find().sort({ memberCount: -1 });
    
    console.log(`✅ Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour, ${results.skipped} ignorées`);

    res.json({
      success: true,
      message: `Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour, ${results.skipped} ignorées`,
      stats: results,
      data: skills.slice(0, 20) // Retourne seulement les 20 premières pour éviter des réponses trop lourdes
    });

  } catch (err) {
    console.error('💥 POST /api/v1/skills/sync error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la synchronisation des compétences',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// POST /api/v1/skills/batch - Créer plusieurs compétences en une seule requête
router.post('/batch', async (req, res) => {
  try {
    const { skills } = req.body;
    
    if (!skills || !Array.isArray(skills)) {
      return res.status(400).json({ 
        success: false,
        message: 'Le tableau des compétences est requis' 
      });
    }

    if (skills.length > 50) {
      return res.status(400).json({ 
        success: false,
        message: 'Maximum 50 compétences par requête' 
      });
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    const createdSkills = [];

    for (const skillData of skills) {
      try {
        const { name, category, description } = skillData;
        
        if (!name || name.trim().length < 2) {
          results.skipped++;
          continue;
        }

        const formattedName = formatSkillName(name.trim());
        
        // Vérifier si la compétence existe déjà
        const existingSkill = await Skill.findOne({ 
          name: { $regex: new RegExp(`^${formattedName}$`, 'i') } 
        });
        
        if (existingSkill) {
          results.skipped++;
          continue;
        }

        const skill = await Skill.create({
          name: formattedName,
          category: category || categorizeSkill(formattedName),
          description: description || generateSkillDescription(formattedName, category),
          memberCount: 0,
          popularity: 0
        });

        createdSkills.push(skill);
        results.created++;
        
      } catch (error) {
        results.errors.push(`Erreur avec ${skillData.name}: ${error.message}`);
      }
    }

    res.status(201).json({
      success: true,
      data: createdSkills,
      stats: results,
      message: `Création par lot terminée: ${results.created} créées, ${results.skipped} ignorées`
    });
  } catch (err) {
    console.error('💥 POST /api/v1/skills/batch error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la création par lot des compétences',
      error: err.message 
    });
  }
});

// Les autres routes restent similaires mais avec des améliorations
// GET /api/v1/skills/:id
router.get('/:id', async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      return res.status(404).json({ 
        success: false,
        message: 'Compétence non trouvée' 
      });
    }
    
    // Récupérer les membres ayant cette compétence
    const membersWithSkill = await Member.find({
      skills: { 
        $regex: new RegExp(`^${skill.name}$`, 'i') 
      }
    }).select('name email position department').limit(10);
    
    res.json({
      success: true,
      data: {
        ...skill.toObject(),
        members: membersWithSkill
      }
    });
  } catch (err) {
    console.error('💥 GET /api/v1/skills/:id error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération de la compétence',
      error: err.message 
    });
  }
});

// PUT /api/v1/skills/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, description } = req.body;
    
    // Validation des données
    if (name && name.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Le nom de la compétence doit contenir au moins 2 caractères' 
      });
    }
    
    const updateData = { 
      ...req.body, 
      updatedAt: new Date() 
    };
    
    // Formater le nom si fourni
    if (name) {
      updateData.name = formatSkillName(name.trim());
    }

    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!skill) {
      return res.status(404).json({ 
        success: false,
        message: 'Compétence non trouvée' 
      });
    }
    
    res.json({
      success: true,
      data: skill,
      message: 'Compétence mise à jour avec succès'
    });
  } catch (err) {
    console.error('💥 PUT /api/v1/skills/:id error:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        success: false,
        message: 'Données de compétence invalides',
        errors: errors
      });
    }
    
    if (err.code === 11000) {
      return res.status(409).json({ 
        success: false,
        message: 'Une compétence avec ce nom existe déjà' 
      });
    }
    
    res.status(400).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour de la compétence',
      error: err.message 
    });
  }
});

// DELETE /api/v1/skills/:id
router.delete('/:id', async (req, res) => {
  try {
    const skill = await Skill.findByIdAndDelete(req.params.id);
    
    if (!skill) {
      return res.status(404).json({ 
        success: false,
        message: 'Compétence non trouvée' 
      });
    }
    
    console.log(`🗑️ Compétence supprimée: ${skill.name}`);
    
    res.json({
      success: true,
      message: 'Compétence supprimée avec succès',
      deletedSkill: {
        id: skill._id,
        name: skill.name
      }
    });
  } catch (err) {
    console.error('💥 DELETE /api/v1/skills/:id error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de la compétence',
      error: err.message 
    });
  }
});

// POST /api/v1/skills/sync-from-default
router.post('/sync-from-default', async (req, res) => {
  try {
    console.log("🔄 POST /api/v1/skills/sync-from-default request");
    
    const defaultSkills = [
      { name: "JavaScript", category: "langage", description: "Langage de programmation web" },
      { name: "React", category: "technique", description: "Bibliothèque frontend JavaScript" },
      { name: "Node.js", category: "technique", description: "Runtime JavaScript serveur" },
      { name: "Python", category: "langage", description: "Langage de programmation polyvalent" },
      { name: "MongoDB", category: "technique", description: "Base de données NoSQL" },
      { name: "UI/UX Design", category: "design", description: "Conception d'interfaces utilisateur et d'expériences utilisateur" },
      { name: "Gestion de projet", category: "management", description: "Planification et gestion de projets" },
      { name: "Communication", category: "soft", description: "Compétences en communication interpersonnelle" },
      { name: "Leadership", category: "soft", description: "Compétences en leadership et management d'équipe" },
      { name: "Résolution de problèmes", category: "soft", description: "Analyse et résolution de problèmes complexes" }
    ];

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const skillData of defaultSkills) {
      try {
        const existingSkill = await Skill.findOne({ 
          name: { $regex: new RegExp(`^${skillData.name}$`, 'i') } 
        });
        
        if (existingSkill) {
          await Skill.findByIdAndUpdate(existingSkill._id, {
            ...skillData,
            updatedAt: new Date()
          });
          results.updated++;
        } else {
          await Skill.create({
            ...skillData,
            memberCount: 0,
            popularity: 0
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Erreur avec ${skillData.name}: ${error.message}`);
        console.error(`❌ Erreur avec ${skillData.name}:`, error.message);
      }
    }

    console.log(`✅ Synchronisation compétences par défaut: ${results.created} créées, ${results.updated} mises à jour`);

    res.json({
      success: true,
      message: `Synchronisation des compétences par défaut terminée: ${results.created} créées, ${results.updated} mises à jour`,
      ...results
    });

  } catch (err) {
    console.error('💥 POST /api/v1/skills/sync-from-default error:', err);
    res.status(500).json({ 
      success: false,
      message: "Erreur lors de la synchronisation des compétences par défaut",
      error: err.message 
    });
  }
});

// Fonctions utilitaires
function isValidSortField(sort) {
  const field = sort.replace(/^-/, '');
  return SKILLS_CONFIG.sortFields.includes(field);
}

function categorizeSkill(skillName) {
  const name = skillName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(SKILLS_CONFIG.categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }

  return 'technique';
}

function formatSkillName(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateSkillDescription(name, category) {
  const descriptions = {
    langage: `Langage de programmation ${name}`,
    technique: `Compétence technique en ${name}`,
    design: `Compétence en design ${name}`,
    outil: `Outil ${name} pour le développement`,
    management: `Compétence en management ${name}`,
    soft: `Compétence comportementale en ${name}`,
    domaine: `Compétence métier en ${name}`
  };
  
  return descriptions[category] || `Compétence en ${name}`;
}

module.exports = router;
