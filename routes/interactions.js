// routes/interactions.js - VERSION CORRIGÉE
const express = require('express');
const router = express.Router();
const Interaction = require('../models/Interaction');

// GET toutes les interactions avec filtres CORRIGÉS
router.get('/', async (req, res) => {
  try {
    const { 
      type, 
      status, 
      limit = 50,
      page = 1 
    } = req.query;

    // 🔥 CORRECTION : Filtres adaptés au modèle simplifié
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const interactions = await Interaction.find(filter)
      .populate('from', 'name email organization title')
      .populate('to', 'name email organization title')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category') // 🔥 CORRECTION : champs simplifiés
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Interaction.countDocuments(filter);

    res.json({
      success: true,
      data: interactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('💥 GET /interactions error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la récupération des interactions' 
    });
  }
});

// 🔥 NOUVELLE ROUTE : Interactions par membre
router.get('/member/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 20 } = req.query;

    const interactions = await Interaction.find({
      $or: [
        { from: memberId },
        { to: memberId }
      ]
    })
      .populate('from', 'name title organization')
      .populate('to', 'name title organization')
      .populate('projects', 'name status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: interactions,
      total: interactions.length
    });
  } catch (err) {
    console.error('💥 GET /interactions/member/:memberId error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des interactions du membre' 
    });
  }
});

// GET une interaction par ID (CORRIGÉ)
router.get('/:id', async (req, res) => {
  try {
    const interaction = await Interaction.findById(req.params.id)
      .populate('from', 'name email organization title specialties')
      .populate('to', 'name email organization title specialties')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category'); // 🔥 CORRECTION

    if (!interaction) {
      return res.status(404).json({ 
        success: false,
        message: 'Interaction non trouvée' 
      });
    }

    res.json({
      success: true,
      data: interaction
    });
  } catch (err) {
    console.error(`💥 GET /interactions/${req.params.id} error:`, err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la récupération de l\'interaction' 
    });
  }
});

// POST ajouter une interaction (DÉJÀ BON)
router.post('/', async (req, res) => {
  try {
    const newInteraction = new Interaction(req.body);
    const savedInteraction = await newInteraction.save();

    const populated = await Interaction.findById(savedInteraction._id)
      .populate('from', 'name email organization title')
      .populate('to', 'name email organization title')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Interaction créée avec succès'
    });
  } catch (err) {
    console.error('💥 POST /interactions error:', err);
    res.status(400).json({ 
      success: false,
      message: err.message || 'Erreur lors de la création de l\'interaction' 
    });
  }
});

// PUT modifier une interaction (DÉJÀ BON)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Interaction.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    )
      .populate('from', 'name email organization title')
      .populate('to', 'name email organization title')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category');

    if (!updated) {
      return res.status(404).json({ 
        success: false,
        message: 'Interaction non trouvée' 
      });
    }

    res.json({
      success: true,
      data: updated,
      message: 'Interaction mise à jour avec succès'
    });
  } catch (err) {
    console.error(`💥 PUT /interactions/${req.params.id} error:`, err);
    res.status(400).json({ 
      success: false,
      message: err.message || 'Erreur lors de la mise à jour' 
    });
  }
});

// DELETE supprimer une interaction (DÉJÀ BON)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Interaction.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Interaction non trouvée' 
      });
    }

    res.json({
      success: true,
      message: 'Interaction supprimée avec succès',
      deletedId: deleted._id
    });
  } catch (err) {
    console.error(`💥 DELETE /interactions/${req.params.id} error:`, err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la suppression' 
    });
  }
});

// 🔥 NOUVELLE ROUTE : Statistiques des interactions
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Interaction.aggregate([
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          byType: { $push: "$type" },
          byStatus: { $push: "$status" },
          avgIntensity: { $avg: "$intensity" },
          avgScore: { $avg: "$score" }
        }
      }
    ]);

    const typeStats = await Interaction.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          avgIntensity: { $avg: "$intensity" }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        byType: typeStats
      }
    });
  } catch (err) {
    console.error('💥 GET /interactions/stats/overview error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des statistiques' 
    });
  }
});

module.exports = router;
