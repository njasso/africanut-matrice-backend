// models/SynergyAnalysis.js
const mongoose = require('mongoose');

const synergyAnalysisSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  analysisData: {
    synergies: [{
      member1: mongoose.Schema.Types.Mixed,
      member2: mongoose.Schema.Types.Mixed,
      score: Number,
      reason: String,
      type: String,
      potential: String,
      recommendedActions: [String]
    }],
    projectOpportunities: [mongoose.Schema.Types.Mixed],
    summary: mongoose.Schema.Types.Mixed,
    timestamp: Date
  },
  statistics: {
    totalMembers: Number,
    totalProjects: Number,
    totalSkills: Number,
    totalSynergies: Number,
    totalOpportunities: Number
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SynergyAnalysis', synergyAnalysisSchema);
