// routes/analyses.js - VERSION COMPLÈTEMENT CORRIGÉE
const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');

// 🔥 CORRECTION : Route pour sauvegarder les analyses de synergies
router.post('/save-synergy-analysis', async (req, res) => {
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
        message: 'Titre et données d\'analyse sont requis'
      });
    }

    // 🔥 CORRECTION : Structure EXACTE pour le frontend React
    const analysisDoc = new Analysis({
      type: 'professional_synergy_analysis',
      title: title.trim(),
      description: description?.trim() || `Analyse des synergies professionnelles - ${new Date().toLocaleDateString('fr-FR')}`,
      
      // 🔥 analysisData DOIT contenir la structure complète du frontend
      analysisData: {
        synergies: analysisData.synergies || [],
        projectOpportunities: analysisData.projectOpportunities || [],
        summary: analysisData.summary || {
          totalSynergies: analysisData.synergies?.length || 0,
          highPotentialSynergies: analysisData.synergies?.filter(s => s.potential === 'Élevé' || s.potential === 'Exceptionnel').length || 0,
          projectOpportunities: analysisData.projectOpportunities?.length || 0,
          analyzedMembers: statistics?.totalMembers || 0,
          aiEnhanced: statistics?.aiEnhanced || false,
          aiAnalysesCount: statistics?.aiEnhancedCount || 0,
          aiModel: statistics?.aiModel || null
        },
        timestamp: timestamp
      },
      
      // 🔥 insights pour les métriques
      insights: {
        totalSynergies: analysisData.synergies?.length || 0,
        highPotential: analysisData.synergies?.filter(s => s.potential === 'Élevé' || s.potential === 'Exceptionnel').length || 0,
        projectOpportunities: analysisData.projectOpportunities?.length || 0,
        analyzedMembers: statistics?.totalMembers || 0
      },
      
      // 🔥 suggestions extraites des synergies
      suggestions: analysisData.synergies?.map(synergy => ({
        members: [synergy.member1?.name, synergy.member2?.name],
        score: synergy.score,
        potential: synergy.potential,
        reason: synergy.reason,
        recommendedActions: synergy.recommendedActions,
        type: synergy.type
      })) || [],
      
      // 🔥 dataSummary pour les statistiques de base
      dataSummary: {
        membersAnalyzed: statistics?.totalMembers || 0,
        projectsAnalyzed: statistics?.totalProjects || 0,
        skillsAnalyzed: statistics?.totalSkills || 0,
        specialtiesAnalyzed: statistics?.totalSpecialties || 0
      },
      
      // 🔥 statistics DOIT contenir les champs IA pour le frontend
      statistics: {
        totalMembers: statistics?.totalMembers || 0,
        totalProjects: statistics?.totalProjects || 0,
        totalSkills: statistics?.totalSkills || 0,
        totalSpecialties: statistics?.totalSpecialties || 0,
        totalSynergies: analysisData.synergies?.length || 0,
        totalOpportunities: analysisData.projectOpportunities?.length || 0,
        
        // 🔥 CHAMPS CRITIQUES POUR L'UI REACT
        aiEnhanced: statistics?.aiEnhanced || false,
        aiEnhancedCount: statistics?.aiEnhancedCount || 0,
        aiModel: statistics?.aiModel || null
      },
      
      // 🔥 Champs IA pour le modèle
      aiEnhanced: statistics?.aiEnhanced || false,
      aiEnhancedCount: statistics?.aiEnhancedCount || 0,
      aiModel: statistics?.aiModel || null,
      
      analysisTimestamp: timestamp,
      status: 'completed'
    });

    const savedAnalysis = await analysisDoc.save();
    
    console.log('✅ Analyse sauvegardée:', savedAnalysis._id);
    
    res.status(201).json({
      success: true,
      message: 'Analyse de synergies sauvegardée avec succès',
      data: savedAnalysis,
      analysisId: savedAnalysis._id
    });
    
  } catch (error) {
    console.error('💥 Erreur sauvegarde analyse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde de l\'analyse',
      error: error.message
    });
  }
});

// GET toutes les analyses de synergies
router.get('/synergy-analyses', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const analyses = await Analysis.find({ 
      type: 'professional_synergy_analysis' 
    })
      .sort({ analysisTimestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Analysis.countDocuments({ 
      type: 'professional_synergy_analysis' 
    });

    res.json({
      success: true,
      data: analyses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('💥 GET /analyses/synergy-analyses error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses'
    });
  }
});

// GET une analyse spécifique
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
    console.error(`💥 GET /analyses/${req.params.id} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'analyse'
    });
  }
});

// DELETE supprimer une analyse
router.delete('/:id', async (req, res) => {
  try {
    const deletedAnalysis = await Analysis.findByIdAndDelete(req.params.id);
    
    if (!deletedAnalysis) {
      return res.status(404).json({
        success: false,
        message: 'Analyse non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Analyse supprimée avec succès',
      deletedId: deletedAnalysis._id
    });
  } catch (error) {
    console.error(`💥 DELETE /analyses/${req.params.id} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
});

// GET analyses récentes
router.get('/synergy-analyses/recent/:limit?', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    
    const analyses = await Analysis.find({ 
      type: 'professional_synergy_analysis' 
    })
      .sort({ analysisTimestamp: -1 })
      .limit(limit)
      .select('title description insights statistics analysisTimestamp aiEnhanced');

    res.json({
      success: true,
      data: analyses,
      total: analyses.length
    });
  } catch (error) {
    console.error('💥 GET /analyses/synergy-analyses/recent error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses récentes'
    });
  }
});

// GET statistiques des analyses
router.get('/stats/synergies', async (req, res) => {
  try {
    const stats = await Analysis.aggregate([
      { $match: { type: 'professional_synergy_analysis' } },
      {
        $group: {
          _id: null,
          totalAnalyses: { $sum: 1 },
          totalAiAnalyses: { $sum: { $cond: ['$aiEnhanced', 1, 0] } },
          totalSynergies: { $sum: '$insights.totalSynergies' },
          totalHighPotential: { $sum: '$insights.highPotential' },
          avgSynergiesPerAnalysis: { $avg: '$insights.totalSynergies' },
          latestAnalysis: { $max: '$analysisTimestamp' }
        }
      }
    ]);

    const aiStats = await Analysis.aggregate([
      { $match: { type: 'professional_synergy_analysis', aiEnhanced: true } },
      {
        $group: {
          _id: '$aiModel',
          count: { $sum: 1 },
          totalEnhanced: { $sum: '$aiEnhancedCount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        aiBreakdown: aiStats
      }
    });
  } catch (error) {
    console.error('💥 GET /analyses/stats/synergies error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router;
