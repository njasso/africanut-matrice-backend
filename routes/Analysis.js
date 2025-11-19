// routes/analyses.js - VERSION CORRIGÉE
const Analysis = require('../models/Analysis');

router.post('/save-synergy-analysis', async (req, res) => {
  try {
    const { 
      type, 
      title, 
      description, 
      analysisData, 
      statistics 
    } = req.body;

    // Adapter les données du frontend au schéma
    const analysisDoc = new Analysis({
      type: 'professional_synergy_analysis', // Forcer le type valide
      title,
      description,
      analysisData: analysisData, // Stocker dans analysisData
      insights: analysisData.summary || {},
      suggestions: analysisData.synergies || [],
      statistics: statistics || {},
      dataSummary: {
        totalMembers: statistics?.totalMembers || 0,
        totalProjects: statistics?.totalProjects || 0
      },
      analysisTimestamp: analysisData.timestamp || new Date()
    });

    const savedAnalysis = await analysisDoc.save();
    
    res.json({
      success: true,
      message: 'Analyse de synergies sauvegardée avec succès',
      data: savedAnalysis
    });
  } catch (error) {
    console.error('💥 Erreur sauvegarde analyse:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde'
    });
  }
});
