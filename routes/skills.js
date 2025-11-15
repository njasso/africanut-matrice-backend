// routes/skills.js - VERSION CORRIGÉE AVEC GESTION D'ERREURS
const express = require('express');
const router = express.Router();
const Skill = require('../models/Skill');
const Member = require('../models/Member');

// GET /api/v1/skills - Récupérer toutes les compétences
router.get('/', async (req, res) => {
  try {
    const { limit = 100, sort = '-memberCount' } = req.query;
    
    console.log(`🛠️ GET /api/v1/skills request - limit: ${limit}, sort: ${sort}`);
    
    const skills = await Skill.find()
      .sort(sort)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: skills,
      pagination: {
        limit: parseInt(limit),
        total: skills.length
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

// POST /api/v1/skills/sync - Synchroniser les compétences avec les membres (CORRIGÉE)
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
            const name = skillName.trim();
            if (!skillMap.has(name)) {
              skillMap.set(name, {
                name: name,
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
      errors: []
    };

    // Synchroniser avec la base de données
    for (const [name, data] of skillMap) {
      try {
        const existingSkill = await Skill.findOne({ 
          name: { $regex: new RegExp(`^${name}$`, 'i') } 
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
            description: `Compétence en ${data.name}`
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Erreur avec ${data.name}: ${error.message}`);
        console.error(`❌ Erreur avec ${data.name}:`, error.message);
      }
    }

    // Supprimer les compétences orphelines (optionnel - commenté pour sécurité)
    /*
    const usedSkills = Array.from(skillMap.keys());
    const deleteResult = await Skill.deleteMany({
      name: { 
        $nin: usedSkills.map(s => new RegExp(`^${s}$`, 'i')) 
      }
    });
    results.deleted = deleteResult.deletedCount;
    */

    const skills = await Skill.find().sort({ memberCount: -1 });
    
    console.log(`✅ Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour, ${results.deleted} supprimées`);

    res.json({
      success: true,
      message: `Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour, ${results.deleted} supprimées`,
      stats: results,
      data: skills
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

// POST /api/v1/skills - Créer une nouvelle compétence (CORRIGÉE)
router.post('/', async (req, res) => {
  try {
    const { name, category, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: 'Le nom de la compétence est requis' 
      });
    }

    // Vérifier si la compétence existe déjà
    const existingSkill = await Skill.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingSkill) {
      return res.status(409).json({ 
        success: false,
        message: 'Cette compétence existe déjà' 
      });
    }

    const skill = new Skill({
      name: name.trim(),
      category: category || categorizeSkill(name),
      description: description || '',
      memberCount: 0,
      popularity: 0
    });

    await skill.save();
    
    console.log(`✅ Compétence créée: ${skill.name}`);
    
    res.status(201).json({
      success: true,
      data: skill,
      message: 'Compétence créée avec succès'
    });
  } catch (err) {
    console.error('💥 POST /api/v1/skills error:', err);
    
    // Gestion spécifique des erreurs de validation MongoDB
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
        message: 'Cette compétence existe déjà' 
      });
    }
    
    res.status(400).json({ 
      success: false,
      message: 'Erreur lors de la création de la compétence',
      error: err.message 
    });
  }
});

// Les autres routes restent inchangées mais avec la même gestion d'erreurs
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
    res.json({
      success: true,
      data: skill
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
    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
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
      message: 'Compétence supprimée avec succès'
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
      { name: "React", category: "technique", description: "Bibliothèque frontend" },
      { name: "Node.js", category: "technique", description: "Runtime JavaScript serveur" },
      { name: "Python", category: "langage", description: "Langage polyvalent" },
      { name: "MongoDB", category: "technique", description: "Base de données NoSQL" },
      { name: "UI/UX Design", category: "design", description: "Design d'interface" },
      { name: "Gestion de projet", category: "management", description: "Gestion de projets" },
      { name: "Communication", category: "soft", description: "Compétences communication" },
      { name: "Leadership", category: "soft", description: "Compétences en leadership" },
      { name: "Résolution de problèmes", category: "soft", description: "Analyse et résolution" }
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

// Fonction de catégorisation améliorée
function categorizeSkill(skillName) {
  const name = skillName.toLowerCase();
  
  const categories = {
    langage: ['javascript', 'python', 'java', 'typescript', 'php', 'ruby', 'go', 'c#', 'c++', 'swift', 'html', 'css', 'sql'],
    technique: ['react', 'angular', 'vue', 'node', 'express', 'django', 'spring', 'docker', 'kubernetes', 'mongodb', 'mysql', 'postgresql'],
    design: ['ui', 'ux', 'design', 'figma', 'photoshop', 'illustrator', 'sketch'],
    outil: ['git', 'jenkins', 'vscode', 'postman', 'jira', 'trello', 'slack'],
    management: ['gestion', 'management', 'leadership', 'projet', 'équipe', 'agile', 'scrum', 'kanban'],
    soft: ['communication', 'créativité', 'adaptabilité', 'résolution', 'empathie', 'collaboration', 'travail d\'équipe'],
    domaine: ['finance', 'marketing', 'rh', 'juridique', 'commercial', 'santé', 'éducation']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }

  return 'technique';
}

module.exports = router;