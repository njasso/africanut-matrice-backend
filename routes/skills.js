// routes/skills.js - VERSION APPWRITE AVEC MONGODB ATLAS
const express = require('express');
const router = express.Router();
const { Client, Databases, ID, Query } = require('node-appwrite');

// Configuration AppWrite avec VOTRE ENDPOINT
const APPWRITE_CONFIG = {
  ENDPOINT: process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: process.env.APPWRITE_PROJECT_ID || '6917d4340008cda26023',
  FUNCTION_ID: process.env.APPWRITE_FUNCTION_ID || '6917e0420005d9ac19c9',
  API_KEY: process.env.APPWRITE_API_KEY
};

// Configuration de la base de données MongoDB Atlas connectée à Appwrite
const DATABASE_ID = 'matrice'; // Votre base de données MongoDB Atlas
const SKILLS_COLLECTION_ID = 'skills'; // Collection dans MongoDB Atlas
const MEMBERS_COLLECTION_ID = 'members'; // Collection dans MongoDB Atlas

// Initialisation du client Appwrite
const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
    .setProject(APPWRITE_CONFIG.PROJECT_ID)
    .setKey(APPWRITE_CONFIG.API_KEY);

const databases = new Databases(client);

// Configuration des compétences
const SKILLS_CONFIG = {
  defaultLimit: 100,
  maxLimit: 500,
  sortFields: ['name', 'memberCount', 'popularity', 'category', 'createdAt', 'updatedAt'],
  defaultSort: 'memberCountDesc',
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
  
  if (limit && (isNaN(limit) || parseInt(limit) <= 0)) {
    return res.status(400).json({
      success: false,
      message: `Le paramètre 'limit' doit être un nombre positif`
    });
  }
  
  next();
};

// GET /api/v1/skills - Récupérer toutes les compétences
router.get('/', validateQueryParams, async (req, res) => {
  try {
    const { 
      limit = SKILLS_CONFIG.defaultLimit, 
      sort = SKILLS_CONFIG.defaultSort,
      category,
      search
    } = req.query;
    
    console.log(`🛠️ GET /api/v1/skills request - limit: ${limit}, sort: ${sort}, category: ${category}, search: ${search}`);
    
    // Construction des queries Appwrite
    const queries = [];
    
    // Filtre par catégorie
    if (category && category !== 'all') {
      queries.push(Query.equal('category', category));
    }
    
    // Filtre par recherche textuelle
    if (search) {
      queries.push(Query.search('name', search));
    }
    
    // Gestion du tri
    let sortQuery;
    switch(sort) {
      case 'name':
        sortQuery = Query.orderAsc('name');
        break;
      case '-name':
        sortQuery = Query.orderDesc('name');
        break;
      case 'memberCount':
        sortQuery = Query.orderAsc('memberCount');
        break;
      case '-memberCount':
      default:
        sortQuery = Query.orderDesc('memberCount');
        break;
    }
    
    queries.push(sortQuery);
    
    // Limite
    const actualLimit = Math.min(parseInt(limit), SKILLS_CONFIG.maxLimit);
    queries.push(Query.limit(actualLimit));

    // Récupération depuis Appwrite (qui interroge MongoDB Atlas)
    const response = await databases.listDocuments(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      queries
    );

    res.json({
      success: true,
      data: response.documents,
      pagination: {
        limit: actualLimit,
        total: response.total
      },
      filters: {
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

// GET /api/v1/skills/stats/overview - Statistiques des compétences
router.get('/stats/overview', async (req, res) => {
  try {
    console.log('📊 GET /api/v1/skills/stats/overview request');
    
    // Récupérer toutes les compétences
    const skillsResponse = await databases.listDocuments(
      DATABASE_ID,
      SKILLS_COLLECTION_ID
    );
    
    // Récupérer les membres avec compétences
    const membersResponse = await databases.listDocuments(
      DATABASE_ID,
      MEMBERS_COLLECTION_ID,
      [Query.isNotNull('skills')]
    );
    
    const totalSkills = skillsResponse.total;
    const totalMembersWithSkills = membersResponse.documents.filter(member => 
      member.skills && member.skills.length > 0
    ).length;
    
    // Compétences populaires
    const popularSkills = skillsResponse.documents
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 5)
      .map(skill => ({
        name: skill.name,
        memberCount: skill.memberCount,
        popularity: skill.popularity
      }));
    
    // Statistiques par catégorie
    const categoriesStats = skillsResponse.documents.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = { count: 0, totalMembers: 0 };
      }
      acc[skill.category].count++;
      acc[skill.category].totalMembers += skill.memberCount;
      return acc;
    }, {});
    
    // Compétences récentes
    const recentSkills = skillsResponse.documents
      .sort((a, b) => new Date(b.$createdAt || b.createdAt) - new Date(a.$createdAt || a.createdAt))
      .slice(0, 5)
      .map(skill => ({
        name: skill.name,
        createdAt: skill.$createdAt || skill.createdAt,
        category: skill.category
      }));

    res.json({
      success: true,
      data: {
        totalSkills,
        totalMembersWithSkills,
        popularSkills,
        categories: Object.entries(categoriesStats).map(([name, stats]) => ({ 
          name, 
          count: stats.count,
          totalMembers: stats.totalMembers 
        })),
        recentSkills,
        averagePopularity: popularSkills.length > 0 
          ? popularSkills.reduce((acc, skill) => acc + (skill.popularity || 0), 0) / popularSkills.length 
          : 0
      }
    });
  } catch (err) {
    console.error('💥 GET /api/v1/skills/stats/overview error:', err);
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
    
    // Récupérer tous les membres
    const membersResponse = await databases.listDocuments(
      DATABASE_ID,
      MEMBERS_COLLECTION_ID
    );
    
    const members = membersResponse.documents;
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
      errors: [],
      skipped: 0
    };

    // Récupérer les compétences existantes
    const existingSkillsResponse = await databases.listDocuments(
      DATABASE_ID,
      SKILLS_COLLECTION_ID
    );
    
    const existingSkillsMap = new Map();
    existingSkillsResponse.documents.forEach(skill => {
      existingSkillsMap.set(skill.name.toLowerCase(), skill);
    });

    // Synchroniser avec la base de données
    for (const [key, data] of skillMap) {
      try {
        // Ignorer les compétences vides ou trop courtes
        if (data.name.length < 2) {
          results.skipped++;
          continue;
        }

        const existingSkill = existingSkillsMap.get(data.name.toLowerCase());

        if (existingSkill) {
          // Mettre à jour la compétence existante
          await databases.updateDocument(
            DATABASE_ID,
            SKILLS_COLLECTION_ID,
            existingSkill.$id,
            {
              name: data.name,
              category: data.category,
              memberCount: data.memberCount,
              popularity: members.length > 0 ? (data.memberCount / members.length) * 100 : 0,
              updatedAt: new Date().toISOString()
            }
          );
          results.updated++;
        } else {
          // Créer une nouvelle compétence
          await databases.createDocument(
            DATABASE_ID,
            SKILLS_COLLECTION_ID,
            ID.unique(),
            {
              name: data.name,
              category: data.category,
              memberCount: data.memberCount,
              popularity: members.length > 0 ? (data.memberCount / members.length) * 100 : 0,
              description: generateSkillDescription(data.name, data.category),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          );
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Erreur avec ${data.name}: ${error.message}`);
        console.error(`❌ Erreur avec ${data.name}:`, error.message);
      }
    }

    // Récupérer les compétences mises à jour
    const updatedSkillsResponse = await databases.listDocuments(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      [Query.orderDesc('memberCount'), Query.limit(20)]
    );
    
    console.log(`✅ Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour, ${results.skipped} ignorées`);

    res.json({
      success: true,
      message: `Synchronisation terminée: ${results.created} créées, ${results.updated} mises à jour, ${results.skipped} ignorées`,
      stats: results,
      data: updatedSkillsResponse.documents
    });

  } catch (err) {
    console.error('💥 POST /api/v1/skills/sync error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la synchronisation des compétences',
      error: err.message
    });
  }
});

// POST /api/v1/skills - Créer une nouvelle compétence
router.post('/', async (req, res) => {
  try {
    const { name, category, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: 'Le nom de la compétence est requis' 
      });
    }

    const formattedName = formatSkillName(name.trim());
    
    // Vérifier si la compétence existe déjà
    try {
      const existingSkills = await databases.listDocuments(
        DATABASE_ID,
        SKILLS_COLLECTION_ID,
        [Query.equal('name', formattedName)]
      );
      
      if (existingSkills.total > 0) {
        return res.status(409).json({ 
          success: false,
          message: 'Cette compétence existe déjà' 
        });
      }
    } catch (error) {
      // Continuer si aucune compétence trouvée
    }

    const skillData = {
      name: formattedName,
      category: category || categorizeSkill(formattedName),
      description: description || generateSkillDescription(formattedName, category),
      memberCount: 0,
      popularity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const skill = await databases.createDocument(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      ID.unique(),
      skillData
    );
    
    console.log(`✅ Compétence créée: ${skill.name}`);
    
    res.status(201).json({
      success: true,
      data: skill,
      message: 'Compétence créée avec succès'
    });
  } catch (err) {
    console.error('💥 POST /api/v1/skills error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la création de la compétence',
      error: err.message 
    });
  }
});

// GET /api/v1/skills/:id - Récupérer une compétence spécifique
router.get('/:id', async (req, res) => {
  try {
    const skill = await databases.getDocument(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      req.params.id
    );
    
    // Récupérer les membres ayant cette compétence
    const membersWithSkill = await databases.listDocuments(
      DATABASE_ID,
      MEMBERS_COLLECTION_ID,
      [
        Query.search('skills', skill.name),
        Query.limit(10),
        Query.select(['name', 'email', 'position', 'department'])
      ]
    );
    
    res.json({
      success: true,
      data: {
        ...skill,
        members: membersWithSkill.documents
      }
    });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ 
        success: false,
        message: 'Compétence non trouvée' 
      });
    }
    
    console.error('💥 GET /api/v1/skills/:id error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération de la compétence',
      error: err.message 
    });
  }
});

// PUT /api/v1/skills/:id - Mettre à jour une compétence
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
      updatedAt: new Date().toISOString() 
    };
    
    // Formater le nom si fourni
    if (name) {
      updateData.name = formatSkillName(name.trim());
    }

    const skill = await databases.updateDocument(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      req.params.id,
      updateData
    );
    
    res.json({
      success: true,
      data: skill,
      message: 'Compétence mise à jour avec succès'
    });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ 
        success: false,
        message: 'Compétence non trouvée' 
      });
    }
    
    console.error('💥 PUT /api/v1/skills/:id error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la mise à jour de la compétence',
      error: err.message 
    });
  }
});

// DELETE /api/v1/skills/:id - Supprimer une compétence
router.delete('/:id', async (req, res) => {
  try {
    const skill = await databases.getDocument(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      req.params.id
    );
    
    await databases.deleteDocument(
      DATABASE_ID,
      SKILLS_COLLECTION_ID,
      req.params.id
    );
    
    console.log(`🗑️ Compétence supprimée: ${skill.name}`);
    
    res.json({
      success: true,
      message: 'Compétence supprimée avec succès',
      deletedSkill: {
        id: skill.$id,
        name: skill.name
      }
    });
  } catch (err) {
    if (err.code === 404) {
      return res.status(404).json({ 
        success: false,
        message: 'Compétence non trouvée' 
      });
    }
    
    console.error('💥 DELETE /api/v1/skills/:id error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la suppression de la compétence',
      error: err.message 
    });
  }
});

// POST /api/v1/skills/sync-from-default - Synchroniser avec des compétences par défaut
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
        // Vérifier si la compétence existe déjà
        const existingSkills = await databases.listDocuments(
          DATABASE_ID,
          SKILLS_COLLECTION_ID,
          [Query.equal('name', skillData.name)]
        );
        
        if (existingSkills.total > 0) {
          // Mettre à jour la compétence existante
          await databases.updateDocument(
            DATABASE_ID,
            SKILLS_COLLECTION_ID,
            existingSkills.documents[0].$id,
            {
              ...skillData,
              updatedAt: new Date().toISOString()
            }
          );
          results.updated++;
        } else {
          // Créer une nouvelle compétence
          await databases.createDocument(
            DATABASE_ID,
            SKILLS_COLLECTION_ID,
            ID.unique(),
            {
              ...skillData,
              memberCount: 0,
              popularity: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          );
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
