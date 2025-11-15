const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['interaction_analysis', 'skills_analysis', 'specialties_analysis']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
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
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
analysisSchema.index({ type: 1, createdAt: -1 });
analysisSchema.index({ status: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);