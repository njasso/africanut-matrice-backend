// routes/synergyAnalysis.js
const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');

// POST - Sauvegarder une analyse de synergies
router.post('/', async (req, res) => {
  try {
    console.log('💾 Sauvegarde analyse synergies:', req.body);
    
    const {
      type = 'professional_synergy_analysis',
      title,
      description,
      analysisData,
      statistics,
      timestamp = new Date()
    } = req.body;

    // Validation des données requises
    if (!title || !analysisData) {
      return res.status(400).json({
        success: false,
        message: 'Titre et données d\'analyse requis'
      });
    }

    const newAnalysis = new Analysis({
      type: 'professional_synergy_analysis', // Type forcé valide
      title,
      description: description || `Analyse des synergies professionnelles - ${new Date().toLocaleDateString('fr-FR')}`,
      analysisData: analysisData,
      insights: {
        totalSynergies: analysisData.synergies?.length || 0,
        highPotential: analysisData.synergies?.filter(s => s.potential === 'Élevé').length || 0,
        projectOpportunities: analysisData.projectOpportunities?.length || 0
      },
      suggestions: analysisData.synergies?.map(synergy => ({
        members: [synergy.member1.name, synergy.member2.name],
        score: synergy.score,
        potential: synergy.potential,
        reason: synergy.reason,
        recommendedActions: synergy.recommendedActions
      })) || [],
      dataSummary: {
        membersAnalyzed: statistics?.totalMembers || 0,
        projectsAnalyzed: statistics?.totalProjects || 0,
        skillsAnalyzed: statistics?.totalSkills || 0,
        specialtiesAnalyzed: statistics?.totalSpecialties || 0
      },
      statistics: statistics || {},
      analysisTimestamp: timestamp,
      status: 'completed'
    });

    const savedAnalysis = await newAnalysis.save();
    
    console.log('✅ Analyse sauvegardée avec ID:', savedAnalysis._id);

    res.status(201).json({
      success: true,
      message: 'Analyse de synergies sauvegardée avec succès',
      data: savedAnalysis,
      analysisId: savedAnalysis._id
    });

  } catch (error) {
    console.error('💥 Erreur sauvegarde analyse synergies:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la sauvegarde',
      error: error.message
    });
  }
});

// GET - Récupérer toutes les analyses de synergies
router.get('/', async (req, res) => {
  try {
    const analyses = await Analysis.find({ 
      type: 'professional_synergy_analysis' 
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: analyses,
      total: analyses.length
    });
  } catch (error) {
    console.error('💥 Erreur récupération analyses:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses'
    });
  }
});

// GET - Récupérer une analyse spécifique
router.get('/:id', async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('💥 Erreur récupération analyse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'analyse'
    });
  }
});

module.exports = router;
