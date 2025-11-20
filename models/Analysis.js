// models/Analysis.js - VERSION COMPLÈTEMENT CORRIGÉE
const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'interaction_analysis', 
      'skills_analysis', 
      'specialties_analysis',
      'professional_synergy_analysis', // ✅ POUR VOTRE APPLICATION
      'collaboration_analysis'
    ],
    default: 'professional_synergy_analysis'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // 🔥 CHAMPS CRITIQUES POUR VOTRE FRONTEND REACT
  analysisData: {
    type: mongoose.Schema.Types.Mixed,
    required: true, // ✅ OBLIGATOIRE
    default: {}
  },
  
  insights: {
    totalSynergies: Number,
    highPotential: Number,
    projectOpportunities: Number,
    analyzedMembers: Number
  },
  
  suggestions: [{
    members: [String], // Noms des membres
    score: Number,
    potential: String,
    reason: String,
    recommendedActions: [String],
    type: String
  }],
  
  dataSummary: {
    membersAnalyzed: Number,
    projectsAnalyzed: Number,
    skillsAnalyzed: Number,
    specialtiesAnalyzed: Number
  },
  
  statistics: {
    type: mongoose.Schema.Types.Mixed, // ✅ POUR LES DONNÉES COMPLEXES
    default: {}
  },
  
  // 🔥 TIMESTAMP POUR VOTRE FRONTEND
  analysisTimestamp: {
    type: Date,
    default: Date.now
  },
  
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'completed'
  },
  
  // 🔥 NOUVEAUX CHAMPS POUR L'IA
  aiEnhanced: {
    type: Boolean,
    default: false
  },
  aiEnhancedCount: {
    type: Number,
    default: 0
  },
  aiModel: {
    type: String,
    default: null
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index optimisés
analysisSchema.index({ type: 1, createdAt: -1 });
analysisSchema.index({ status: 1 });
analysisSchema.index({ 'statistics.aiEnhanced': 1 });
analysisSchema.index({ analysisTimestamp: -1 });

// Méthode utilitaire pour les analyses de synergies
analysisSchema.statics.getSynergyAnalyses = function(limit = 20) {
  return this.find({ type: 'professional_synergy_analysis' })
    .sort({ analysisTimestamp: -1 })
    .limit(limit);
};

// Méthode pour compter les analyses IA
analysisSchema.statics.getAiAnalysisStats = function() {
  return this.aggregate([
    { $match: { type: 'professional_synergy_analysis' } },
    {
      $group: {
        _id: '$aiEnhanced',
        total: { $sum: 1 },
        totalAiAnalyses: { $sum: '$aiEnhancedCount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Analysis', analysisSchema);
