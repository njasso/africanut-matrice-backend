// routes/specialties.js
const express = require('express');
const router = express.Router();
const Specialty = require('../models/Specialty');
const Member = require('../models/Member');

// GET /api/v1/specialties - Récupérer toutes les spécialités
router.get('/', async (req, res) => {
  try {
    const specialties = await Specialty.find().sort({ memberCount: -1 });
    res.json(specialties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/specialties/:id - Récupérer une spécialité par ID
router.get('/:id', async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Spécialité non trouvée' });
    }
    res.json(specialty);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/specialties - Créer une nouvelle spécialité
router.post('/', async (req, res) => {
  try {
    const specialty = new Specialty(req.body);
    await specialty.save();
    res.status(201).json(specialty);
  } catch (err) {
    res.status(400).json({ message: err.message });
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
      return res.status(404).json({ message: 'Spécialité non trouvée' });
    }
    res.json(specialty);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/v1/specialties/:id - Supprimer une spécialité
router.delete('/:id', async (req, res) => {
  try {
    const specialty = await Specialty.findByIdAndDelete(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Spécialité non trouvée' });
    }
    res.json({ message: 'Spécialité supprimée' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/v1/specialties/sync - Synchroniser les spécialités avec les membres
router.post('/sync', async (req, res) => {
  try {
    const members = await Member.find();
    const specialtyMap = new Map();

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

    // Synchroniser avec la base de données
    for (const [name, data] of specialtyMap) {
      await Specialty.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${name}$`, 'i') } },
        {
          name: data.name,
          category: data.category,
          memberCount: data.memberCount,
          popularity: (data.memberCount / members.length) * 100,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    // Supprimer les spécialités orphelines
    const usedSpecialties = Array.from(specialtyMap.keys());
    await Specialty.deleteMany({
      name: { $nin: usedSpecialties.map(s => new RegExp(`^${s}$`, 'i')) }
    });

    const specialties = await Specialty.find();
    
    res.json({
      message: `Synchronisation terminée: ${specialties.length} spécialités`,
      specialtiesCount: specialties.length,
      data: specialties
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fonction de catégorisation automatique
function categorizeSpecialty(specialtyName) {
  const name = specialtyName.toLowerCase();
  
  const categories = {
    technique: ['hydraulique', 'génie', 'civil', 'mécanique', 'électrique', 'construction', 'ingénierie'],
    management: ['gestion', 'management', 'leadership', 'projet', 'équipe', 'qualité', 'sécurité'],
    industrie: ['agro', 'industrie', 'manufacturier', 'production', 'logistique'],
    recherche: ['recherche', 'développement', 'r&d', 'innovation', 'biotechnologie', 'scientifique'],
    environnement: ['environnement', 'durable', 'écologie', 'climat', 'biodiversité'],
    energie: ['énergie', 'solaire', 'éolien', 'hydraulique', 'renouvelable', 'nucléaire', 'thermique']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }

  return 'autre';
}

module.exports = router;
