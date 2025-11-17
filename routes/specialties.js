// routes/specialties.js
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

// Initialisation du client AppWrite
const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
  .setProject(APPWRITE_CONFIG.PROJECT_ID)
  .setKey(APPWRITE_CONFIG.API_KEY);

const databases = new Databases(client);

// ID de la base de données et collection (à adapter selon votre configuration)
const DATABASE_ID = 'matrice'; // Remplacez par votre ID de base de données
const SPECIALTIES_COLLECTION_ID = 'specialties'; // Collection pour les spécialités
const MEMBERS_COLLECTION_ID = 'members'; // Collection pour les membres

// GET /api/v1/specialties - Récupérer toutes les spécialités
router.get('/', async (req, res) => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      [
        Query.orderDesc('memberCount'),
        Query.limit(100)
      ]
    );

    res.json({
      success: true,
      data: response.documents,
      total: response.total
    });
  } catch (err) {
    console.error('Erreur récupération spécialités:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur de récupération des spécialités',
      error: err.message 
    });
  }
});

// GET /api/v1/specialties/:id - Récupérer une spécialité par ID
router.get('/:id', async (req, res) => {
  try {
    const specialty = await databases.getDocument(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      req.params.id
    );

    res.json({
      success: true,
      data: specialty
    });
  } catch (err) {
    console.error('Erreur récupération spécialité:', err);
    if (err.code === 404) {
      return res.status(404).json({ 
        success: false,
        message: 'Spécialité non trouvée' 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Erreur de récupération de la spécialité',
      error: err.message 
    });
  }
});

// POST /api/v1/specialties - Créer une nouvelle spécialité
router.post('/', async (req, res) => {
  try {
    const { name, category, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la spécialité est requis'
      });
    }

    // Vérifier si la spécialité existe déjà
    const existingSpecialties = await databases.listDocuments(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      [
        Query.equal('name', name.trim())
      ]
    );

    if (existingSpecialties.total > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Cette spécialité existe déjà' 
      });
    }

    const specialtyData = {
      name: name.trim(),
      category: category || categorizeSpecialty(name),
      description: description || '',
      memberCount: 0,
      popularity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const specialty = await databases.createDocument(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      ID.unique(),
      specialtyData
    );

    res.status(201).json({
      success: true,
      data: specialty,
      message: 'Spécialité créée avec succès'
    });
  } catch (err) {
    console.error('Erreur création spécialité:', err);
    res.status(400).json({ 
      success: false,
      message: 'Erreur de création de la spécialité',
      error: err.message 
    });
  }
});

// PUT /api/v1/specialties/:id - Mettre à jour une spécialité
router.put('/:id', async (req, res) => {
  try {
    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Si le nom est modifié, recatégoriser automatiquement
    if (updates.name) {
      updates.category = categorizeSpecialty(updates.name);
    }

    const specialty = await databases.updateDocument(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      req.params.id,
      updates
    );

    res.json({
      success: true,
      data: specialty,
      message: 'Spécialité mise à jour avec succès'
    });
  } catch (err) {
    console.error('Erreur mise à jour spécialité:', err);
    if (err.code === 404) {
      return res.status(404).json({ 
        success: false,
        message: 'Spécialité non trouvée' 
      });
    }
    res.status(400).json({ 
      success: false,
      message: 'Erreur de mise à jour de la spécialité',
      error: err.message 
    });
  }
});

// DELETE /api/v1/specialties/:id - Supprimer une spécialité
router.delete('/:id', async (req, res) => {
  try {
    await databases.deleteDocument(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      req.params.id
    );

    res.json({ 
      success: true,
      message: 'Spécialité supprimée avec succès' 
    });
  } catch (err) {
    console.error('Erreur suppression spécialité:', err);
    if (err.code === 404) {
      return res.status(404).json({ 
        success: false,
        message: 'Spécialité non trouvée' 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Erreur de suppression de la spécialité',
      error: err.message 
    });
  }
});

// POST /api/v1/specialties/sync - Synchroniser les spécialités avec les membres
router.post('/sync', async (req, res) => {
  try {
    // Récupérer tous les membres
    const membersResponse = await databases.listDocuments(
      DATABASE_ID,
      MEMBERS_COLLECTION_ID,
      [Query.limit(1000)]
    );

    const members = membersResponse.documents;
    const specialtyMap = new Map();

    console.log(`📊 Synchronisation avec ${members.length} membres`);

    // Extraire les spécialités des membres
    members.forEach(member => {
      if (member.specialties && Array.isArray(member.specialties)) {
        member.specialties.forEach(specialtyName => {
          if (specialtyName && typeof specialtyName === 'string' && specialtyName.trim()) {
            const name = specialtyName.trim();
            if (!specialtyMap.has(name)) {
              specialtyMap.set(name, {
                name: name,
                memberCount: 0,
                category: categorizeSpecialty(name)
              });
            }
            specialtyMap.get(name).memberCount++;
          }
        });
      }
    });

    const syncResults = {
      created: 0,
      updated: 0,
      total: specialtyMap.size,
      specialties: []
    };

    // Synchroniser avec la base de données
    for (const [name, data] of specialtyMap) {
      try {
        // Chercher si la spécialité existe déjà
        const existingSpecialties = await databases.listDocuments(
          DATABASE_ID,
          SPECIALTIES_COLLECTION_ID,
          [Query.equal('name', name)]
        );

        const specialtyData = {
          name: data.name,
          category: data.category,
          memberCount: data.memberCount,
          popularity: members.length > 0 ? (data.memberCount / members.length) * 100 : 0,
          updatedAt: new Date().toISOString()
        };

        if (existingSpecialties.total > 0) {
          // Mettre à jour la spécialité existante
          const existing = existingSpecialties.documents[0];
          await databases.updateDocument(
            DATABASE_ID,
            SPECIALTIES_COLLECTION_ID,
            existing.$id,
            specialtyData
          );
          syncResults.updated++;
        } else {
          // Créer une nouvelle spécialité
          specialtyData.createdAt = new Date().toISOString();
          await databases.createDocument(
            DATABASE_ID,
            SPECIALTIES_COLLECTION_ID,
            ID.unique(),
            specialtyData
          );
          syncResults.created++;
        }
      } catch (error) {
        console.error(`Erreur synchronisation spécialité ${name}:`, error);
      }
    }

    // Récupérer les spécialités après synchronisation
    const specialtiesResponse = await databases.listDocuments(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      [Query.orderDesc('memberCount')]
    );

    syncResults.specialties = specialtiesResponse.documents;

    res.json({
      success: true,
      message: `Synchronisation terminée: ${syncResults.created} créées, ${syncResults.updated} mises à jour, ${syncResults.total} au total`,
      data: syncResults
    });

  } catch (err) {
    console.error('Erreur synchronisation spécialités:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur de synchronisation des spécialités',
      error: err.message 
    });
  }
});

// POST /api/v1/specialties/auto-categorize - Catégoriser automatiquement toutes les spécialités
router.post('/auto-categorize', async (req, res) => {
  try {
    const specialtiesResponse = await databases.listDocuments(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      [Query.limit(1000)]
    );

    let updatedCount = 0;
    const updatePromises = specialtiesResponse.documents.map(specialty => {
      const newCategory = categorizeSpecialty(specialty.name);
      
      if (specialty.category !== newCategory) {
        updatedCount++;
        return databases.updateDocument(
          DATABASE_ID,
          SPECIALTIES_COLLECTION_ID,
          specialty.$id,
          {
            category: newCategory,
            updatedAt: new Date().toISOString()
          }
        );
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Catégorisation automatique terminée: ${updatedCount} spécialités mises à jour`,
      data: {
        updated: updatedCount,
        total: specialtiesResponse.total
      }
    });

  } catch (err) {
    console.error('Erreur catégorisation automatique:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur de catégorisation automatique',
      error: err.message 
    });
  }
});

// GET /api/v1/specialties/stats/overview - Récupérer les statistiques des spécialités
router.get('/stats/overview', async (req, res) => {
  try {
    const [specialtiesResponse, membersResponse] = await Promise.all([
      databases.listDocuments(DATABASE_ID, SPECIALTIES_COLLECTION_ID),
      databases.listDocuments(DATABASE_ID, MEMBERS_COLLECTION_ID)
    ]);

    const specialties = specialtiesResponse.documents;
    const members = membersResponse.documents;

    const totalSpecialties = specialties.length;
    const totalMembers = members.length;
    
    // Calculer la moyenne des spécialités par membre
    const totalSpecialtiesCount = members.reduce((acc, member) => {
      return acc + (member.specialties?.length || 0);
    }, 0);
    
    const avgSpecialtiesPerMember = totalMembers > 0 ? 
      (totalSpecialtiesCount / totalMembers).toFixed(1) : 0;

    // Statistiques par catégorie
    const categoryStats = {};
    specialties.forEach(specialty => {
      const category = specialty.category || 'autre';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          totalMembers: 0,
          specialties: []
        };
      }
      categoryStats[category].count++;
      categoryStats[category].totalMembers += specialty.memberCount || 0;
      categoryStats[category].specialties.push({
        name: specialty.name,
        memberCount: specialty.memberCount
      });
    });

    // Top 5 des spécialités les plus populaires
    const mostPopularSpecialties = specialties
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        memberCount: s.memberCount,
        popularity: s.popularity,
        category: s.category
      }));

    res.json({
      success: true,
      data: {
        totalSpecialties,
        totalMembers,
        avgSpecialtiesPerMember: parseFloat(avgSpecialtiesPerMember),
        categoryStats,
        mostPopularSpecialties
      }
    });

  } catch (err) {
    console.error('Erreur récupération statistiques:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur de récupération des statistiques',
      error: err.message 
    });
  }
});

// GET /api/v1/specialties/category/:category - Récupérer les spécialités par catégorie
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const response = await databases.listDocuments(
      DATABASE_ID,
      SPECIALTIES_COLLECTION_ID,
      [
        Query.equal('category', category),
        Query.orderDesc('memberCount')
      ]
    );

    res.json({
      success: true,
      data: response.documents,
      total: response.total,
      category: category
    });
  } catch (err) {
    console.error('Erreur récupération par catégorie:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur de récupération des spécialités par catégorie',
      error: err.message 
    });
  }
});

// Fonction de catégorisation automatique améliorée
function categorizeSpecialty(specialtyName) {
  if (!specialtyName || typeof specialtyName !== 'string') return 'autre';
  
  const name = specialtyName.toLowerCase();
  
  const categories = {
    technique: ['technique', 'ingénieur', 'technolog', 'informatique', 'digital', 'software', 'hardware', 'code', 'programmation', 'développement', 'coding', 'algorithm', 'data', 'ai', 'intelligence artificielle'],
    management: ['gestion', 'management', 'leadership', 'projet', 'équipe', 'qualité', 'sécurité', 'admin', 'coordination', 'supervision', 'stratégie', 'planification', 'organisation'],
    industrie: ['industrie', 'production', 'manufactur', 'usine', 'fabrication', 'process', 'opération', 'maintenance', 'industriel', 'production', 'manufacturing'],
    recherche: ['recherche', 'développement', 'r&d', 'innovation', 'scientifique', 'étude', 'analyse', 'laboratoire', 'expérimentation', 'science', 'académique', 'publication'],
    environnement: ['environnement', 'écolog', 'durable', 'climat', 'biodiversité', 'conservation', 'nature', 'écologique', 'green', 'sustainable', 'écologie'],
    energie: ['énergie', 'solaire', 'éolien', 'hydraulique', 'renouvelable', 'nucléaire', 'thermique', 'électricité', 'power', 'grid', 'smart grid', 'énergie']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }

  return 'autre';
}

module.exports = router;
