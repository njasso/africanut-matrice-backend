// routes/specialties.js - VERSION CORRIGÉE
const express = require('express');
const router = express.Router();
const Specialty = require('../models/Specialty');
const Member = require('../models/Member');

// GET /api/v1/specialties - Récupérer toutes les spécialités avec statistiques
router.get('/', async (req, res) => {
  try {
    const specialties = await Specialty.find({ isActive: true }).sort({ memberCount: -1 });
    
    // Calculer les statistiques globales
    const totalMembers = await Member.countDocuments({ isActive: true });
    
    // Mettre à jour les popularités
    const updatedSpecialties = await Promise.all(
      specialties.map(async (specialty) => {
        if (totalMembers > 0) {
          specialty.popularity = (specialty.memberCount / totalMembers) * 100;
          await specialty.save();
        }
        return specialty;
      })
    );

    res.json({
      success: true,
      data: updatedSpecialties,
      count: updatedSpecialties.length,
      stats: {
        totalSpecialties: updatedSpecialties.length,
        totalMembers: totalMembers,
        avgMembersPerSpecialty: totalMembers > 0 ? (totalMembers / updatedSpecialties.length).toFixed(2) : 0
      }
    });
  } catch (err) {
    console.error('❌ Erreur GET /specialties:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la récupération des spécialités',
      error: err.message 
    });
  }
});

// GET /api/v1/specialties/with-members - Récupérer spécialités avec membres associés
router.get('/with-members', async (req, res) => {
  try {
    const specialties = await Specialty.find({ isActive: true }).sort({ memberCount: -1 });
    const totalMembers = await Member.countDocuments({ isActive: true });

    // Pour chaque spécialité, récupérer les membres associés
    const specialtiesWithMembers = await Promise.all(
      specialties.map(async (specialty) => {
        const members = await Member.find({ 
          specialties: { $regex: new RegExp(specialty.name, 'i') },
          isActive: true 
        }).select('name title email organization');
        
        // Mettre à jour la popularité
        if (totalMembers > 0) {
          specialty.popularity = (members.length / totalMembers) * 100;
          await specialty.save();
        }

        return {
          ...specialty.toObject(),
          members: members,
          memberCount: members.length
        };
      })
    );

    res.json({
      success: true,
      data: specialtiesWithMembers,
      count: specialtiesWithMembers.length
    });
  } catch (err) {
    console.error('❌ Erreur GET /specialties/with-members:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// GET /api/v1/specialties/:id - Récupérer une spécialité par ID avec membres
router.get('/:id', async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ 
        success: false,
        message: 'Spécialité non trouvée' 
      });
    }

    // Récupérer les membres ayant cette spécialité
    const members = await Member.find({ 
      specialties: { $regex: new RegExp(specialty.name, 'i') },
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        ...specialty.toObject(),
        members: members,
        memberCount: members.length
      }
    });
  } catch (err) {
    console.error(`❌ Erreur GET /specialties/${req.params.id}:`, err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// POST /api/v1/specialties - Créer une nouvelle spécialité
router.post('/', async (req, res) => {
  try {
    const { name, category, description, level } = req.body;
    
    // Vérifier si la spécialité existe déjà
    const existingSpecialty = await Specialty.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingSpecialty) {
      return res.status(400).json({
        success: false,
        message: 'Cette spécialité existe déjà'
      });
    }

    // Déterminer la catégorie automatiquement si non fournie
    const finalCategory = category || categorizeSpecialty(name);

    const specialty = new Specialty({
      name: name.trim(),
      category: finalCategory,
      description: description || '',
      level: level || 'intermédiaire',
      memberCount: 0,
      popularity: 0
    });

    await specialty.save();

    res.status(201).json({
      success: true,
      message: 'Spécialité créée avec succès',
      data: specialty
    });
  } catch (err) {
    console.error('❌ Erreur POST /specialties:', err);
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
});

// PUT /api/v1/specialties/:id - Mettre à jour une spécialité
router.put('/:id', async (req, res) => {
  try {
    const specialty = await Specialty.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!specialty) {
      return res.status(404).json({ 
        success: false,
        message: 'Spécialité non trouvée' 
      });
    }

    res.json({
      success: true,
      message: 'Spécialité mise à jour avec succès',
      data: specialty
    });
  } catch (err) {
    console.error(`❌ Erreur PUT /specialties/${req.params.id}:`, err);
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
});

// DELETE /api/v1/specialties/:id - Supprimer une spécialité (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const specialty = await Specialty.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!specialty) {
      return res.status(404).json({ 
        success: false,
        message: 'Spécialité non trouvée' 
      });
    }

    res.json({
      success: true,
      message: 'Spécialité supprimée avec succès'
    });
  } catch (err) {
    console.error(`❌ Erreur DELETE /specialties/${req.params.id}:`, err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// POST /api/v1/specialties/sync - Synchroniser les spécialités avec les membres (IMPORTANT)
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Démarrage synchronisation spécialités...');
    
    const members = await Member.find({ isActive: true });
    const specialtyMap = new Map();
    const totalMembers = members.length;

    console.log(`📊 Analyse de ${totalMembers} membres...`);

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
                category: categorizeSpecialty(name),
                members: []
              });
            }
            
            const specialtyData = specialtyMap.get(name);
            specialtyData.memberCount++;
            specialtyData.members.push(member._id);
          }
        });
      }
    });

    console.log(`🎯 ${specialtyMap.size} spécialités trouvées dans les membres`);

    // Synchroniser avec la base de données
    const syncResults = [];
    
    for (const [name, data] of specialtyMap) {
      try {
        const popularity = totalMembers > 0 ? (data.memberCount / totalMembers) * 100 : 0;
        
        const specialty = await Specialty.findOneAndUpdate(
          { name: { $regex: new RegExp(`^${name}$`, 'i') } },
          {
            name: data.name,
            category: data.category,
            memberCount: data.memberCount,
            popularity: popularity,
            isActive: true,
            updatedAt: new Date()
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true 
          }
        );

        syncResults.push({
          name: specialty.name,
          action: specialty.isNew ? 'CREATED' : 'UPDATED',
          memberCount: specialty.memberCount,
          popularity: specialty.popularity
        });

        console.log(`✅ ${specialty.isNew ? 'Créé' : 'Mis à jour'}: ${specialty.name} (${specialty.memberCount} membres)`);
      } catch (error) {
        console.error(`❌ Erreur sync spécialité ${name}:`, error);
        syncResults.push({
          name: name,
          action: 'ERROR',
          error: error.message
        });
      }
    }

    // Désactiver les spécialités orphelines (aucun membre)
    const usedSpecialtyNames = Array.from(specialtyMap.keys());
    const deactivateResult = await Specialty.updateMany(
      { 
        name: { $nin: usedSpecialtyNames.map(s => new RegExp(`^${s}$`, 'i')) },
        isActive: true
      },
      { 
        isActive: false,
        memberCount: 0,
        popularity: 0,
        updatedAt: new Date()
      }
    );

    console.log(`🗑️ ${deactivateResult.modifiedCount} spécialités orphelines désactivées`);

    const finalSpecialties = await Specialty.find({ isActive: true }).sort({ memberCount: -1 });

    res.json({
      success: true,
      message: `Synchronisation terminée: ${finalSpecialties.length} spécialités actives`,
      stats: {
        totalSpecialties: finalSpecialties.length,
        totalMembers: totalMembers,
        specialtiesCreated: syncResults.filter(r => r.action === 'CREATED').length,
        specialtiesUpdated: syncResults.filter(r => r.action === 'UPDATED').length,
        specialtiesDeactivated: deactivateResult.modifiedCount
      },
      data: finalSpecialties,
      details: syncResults
    });

  } catch (err) {
    console.error('❌ Erreur synchronisation spécialités:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la synchronisation',
      error: err.message 
    });
  }
});

// POST /api/v1/specialties/assign-random - Assigner aléatoirement des spécialités aux membres
router.post('/assign-random', async (req, res) => {
  try {
    const members = await Member.find({ isActive: true });
    const specialties = await Specialty.find({ isActive: true });
    
    let assignedCount = 0;

    for (const member of members) {
      // Assigner 1-3 spécialités aléatoires
      const randomCount = Math.floor(Math.random() * 3) + 1;
      const shuffled = [...specialties].sort(() => 0.5 - Math.random());
      const randomSpecialties = shuffled.slice(0, randomCount);
      
      // Stocker les noms des spécialités (comme dans le modèle Member actuel)
      member.specialties = randomSpecialties.map(spec => spec.name);
      await member.save();
      assignedCount++;
    }

    // Synchroniser les compteurs après assignation
    await syncSpecialtiesCounters();

    res.json({
      success: true,
      message: `Spécialités assignées à ${assignedCount} membres`,
      assignedCount: assignedCount
    });

  } catch (err) {
    console.error('❌ Erreur assignation aléatoire:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Fonction utilitaire pour synchroniser les compteurs
async function syncSpecialtiesCounters() {
  try {
    const specialties = await Specialty.find({ isActive: true });
    
    for (const specialty of specialties) {
      const memberCount = await Member.countDocuments({
        specialties: { $regex: new RegExp(specialty.name, 'i') },
        isActive: true
      });
      
      specialty.memberCount = memberCount;
      await specialty.save();
    }
    
    console.log('✅ Compteurs de spécialités synchronisés');
  } catch (error) {
    console.error('❌ Erreur synchronisation compteurs:', error);
  }
}

// Fonction de catégorisation automatique
function categorizeSpecialty(specialtyName) {
  const name = specialtyName.toLowerCase();
  
  const categories = {
    technique: [
      'technique', 'ingénieur', 'technolog', 'informatique', 'digital', 'software', 
      'hardware', 'code', 'programmation', 'développement', 'coding', 'algorithm', 
      'data', 'ai', 'intelligence artificielle', 'robotique', 'automatisation',
      'hydraulique', 'génie', 'civil', 'mécanique', 'électrique', 'construction', 'ingénierie'
    ],
    management: [
      'gestion', 'management', 'leadership', 'projet', 'équipe', 'qualité', 
      'sécurité', 'admin', 'coordination', 'supervision', 'stratégie', 
      'planification', 'organisation', 'direction'
    ],
    industrie: [
      'industrie', 'production', 'manufactur', 'usine', 'fabrication', 'process', 
      'opération', 'maintenance', 'industriel', 'production', 'manufacturing',
      'usinage', 'assemblage', 'agro', 'logistique'
    ],
    recherche: [
      'recherche', 'développement', 'r&d', 'innovation', 'scientifique', 'étude', 
      'analyse', 'laboratoire', 'expérimentation', 'science', 'académique', 
      'publication', 'thèse', 'doctorat', 'biotechnologie'
    ],
    environnement: [
      'environnement', 'écolog', 'durable', 'climat', 'biodiversité', 'conservation', 
      'nature', 'écologique', 'green', 'sustainable', 'écologie', 'carbone'
    ],
    energie: [
      'énergie', 'solaire', 'éolien', 'hydraulique', 'renouvelable', 'nucléaire', 
      'thermique', 'électricité', 'power', 'grid', 'smart grid'
    ]
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }

  return 'autre';
}

module.exports = router;
