
// models/Interaction.js - VERSION SIMPLIFIÉE
const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'collaboration',
      'mentorship', 
      'project_invite',
      'expertise_share',
      'knowledge_transfer'
    ],
    default: 'collaboration'
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
  
  // Références principales
  from: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    required: true 
  },
  
  to: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member' 
  }],
  
  projects: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project' 
  }],
  
  groups: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Group' 
  }],
  
  specialties: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Specialty' 
  }],
  
  // Statut simplifié
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed', 'canceled'],
    default: 'pending'
  },
  
  // Métriques pour l'analyse
  intensity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  duration: {
    type: Number, // en minutes
    default: 0
  },
  
  score: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index optimisés
interactionSchema.index({ from: 1, createdAt: -1 });
interactionSchema.index({ to: 1 });
interactionSchema.index({ status: 1 });
interactionSchema.index({ type: 1 });

// Virtual pour le nombre de participants
interactionSchema.virtual('participantCount').get(function() {
  return 1 + (this.to ? this.to.length : 0);
});

// Méthode pour les interactions récentes
interactionSchema.statics.getRecentInteractions = function(limit = 50) {
  return this.find()
    .populate('from', 'name title organization')
    .populate('to', 'name title organization')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Interaction', interactionSchema);
