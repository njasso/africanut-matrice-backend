const express = require('express');
const router = express.Router();
const Interaction = require('../models/Interaction');

// GET toutes les interactions avec filtres avancés
router.get('/', async (req, res) => {
  try {
    const { 
      type, 
      status, 
      category, 
      priority, 
      strategic_min,
      limit = 50,
      page = 1 
    } = req.query;

    // Construction du filtre
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter['payload.priority'] = priority;
    if (strategic_min) {
      filter['ai_analysis.strategic_value'] = { $gte: parseInt(strategic_min) };
    }

    const interactions = await Interaction.find(filter)
      .populate('from', 'name email organization title avatar')
      .populate('to', 'name email organization title avatar')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category memberCount')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Count total pour la pagination
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

// GET interactions stratégiques (pour l'analyse IA)
router.get('/strategic/analysis', async (req, res) => {
  try {
    const strategicInteractions = await Interaction.getStrategicInteractions();
    
    res.json({
      success: true,
      data: strategicInteractions,
      analysis: {
        total: strategicInteractions.length,
        avg_strategic_value: strategicInteractions.reduce((acc, curr) => 
          acc + (curr.ai_analysis?.strategic_value || 0), 0) / strategicInteractions.length || 0
      }
    });
  } catch (err) {
    console.error('💥 GET /interactions/strategic/analysis error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la récupération des interactions stratégiques' 
    });
  }
});

// GET une interaction par ID
router.get('/:id', async (req, res) => {
  try {
    const interaction = await Interaction.findById(req.params.id)
      .populate('from', 'name email organization title avatar specialties')
      .populate('to', 'name email organization title avatar specialties')
      .populate('projects', 'name description status timeline')
      .populate('groups', 'name type description memberCount')
      .populate('specialties', 'name category memberCount popularity');

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

// POST ajouter une interaction
router.post('/', async (req, res) => {
  try {
    const newInteraction = new Interaction(req.body);
    const savedInteraction = await newInteraction.save();

    // Populate après sauvegarde (nouvelle méthode Mongoose)
    const populated = await Interaction.findById(savedInteraction._id)
      .populate('from', 'name email organization title avatar')
      .populate('to', 'name email organization title avatar')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category memberCount');

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

// PUT modifier une interaction
router.put('/:id', async (req, res) => {
  try {
    const updated = await Interaction.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    )
      .populate('from', 'name email organization title avatar')
      .populate('to', 'name email organization title avatar')
      .populate('projects', 'name description status')
      .populate('groups', 'name type description')
      .populate('specialties', 'name category memberCount');

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

// DELETE supprimer une interaction
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

// POST analyser une interaction avec IA
router.post('/:id/analyze', async (req, res) => {
  try {
    const interaction = await Interaction.findById(req.params.id)
      .populate('from to projects groups specialties');

    if (!interaction) {
      return res.status(404).json({ 
        success: false,
        message: 'Interaction non trouvée' 
      });
    }

    // Ici vous intégrerez l'appel à l'API DeepSeek
    // Pour l'instant, simulation d'analyse
    const aiAnalysis = {
      strategic_value: Math.floor(Math.random() * 100) + 1,
      recommended_actions: [
        'Organiser une réunion de cadrage',
        'Impliquer des experts supplémentaires',
        'Définir des métriques de succès'
      ],
      risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      success_probability: Math.floor(Math.random() * 100) + 1
    };

    await interaction.markAsAnalyzed(aiAnalysis);

    res.json({
      success: true,
      data: interaction,
      message: 'Interaction analysée avec succès'
    });
  } catch (err) {
    console.error(`💥 POST /interactions/${req.params.id}/analyze error:`, err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de l\'analyse de l\'interaction' 
    });
  }
});

module.exports = router;