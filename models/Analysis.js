// models/Analysis.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'interaction_analysis', 
      'skills_analysis', 
      'specialties_analysis',
      'professional_synergy_analysis', // AJOUTÉ
      'collaboration_analysis' // AJOUTÉ
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  // AJOUTEZ CES CHAMPS POUR CORRESPONDRE AU FRONTEND
  analysisData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  insights: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  suggestions: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  dataSummary: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  statistics: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // AJOUTEZ LE TIMESTAMP DU FRONTEND
  analysisTimestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

analysisSchema.index({ type: 1, createdAt: -1 });
analysisSchema.index({ status: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);
