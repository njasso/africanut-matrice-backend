// models/Specialty.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },
  category: {
    type: String,
    required: true,
    enum: ['technique', 'management', 'industrie', 'recherche', 'environnement', 'energie', 'autre'],
    default: 'technique'
  },
  description: {
    type: String,
    default: ''
  },
  level: {
    type: String,
    enum: ['débutant', 'intermédiaire', 'avancé', 'expert'],
    default: 'intermédiaire'
  },
  memberCount: {
    type: Number,
    default: 0,
    min: 0
  },
  popularity: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index pour l'optimisation
specialtySchema.index({ category: 1, memberCount: -1 });
specialtySchema.index({ isActive: 1 });

// Méthode pour calculer la popularité
specialtySchema.methods.calculatePopularity = function(totalMembers) {
  if (totalMembers > 0) {
    this.popularity = (this.memberCount / totalMembers) * 100;
  } else {
    this.popularity = 0;
  }
  return this.popularity;
};

// Middleware pre-save
specialtySchema.pre('save', function(next) {
  // Nettoyer le nom
  if (this.name) {
    this.name = this.name.trim();
  }
  
  // S'assurer que la popularité est dans les limites
  this.popularity = Math.max(0, Math.min(100, this.popularity));
  
  // S'assurer que memberCount n'est pas négatif
  this.memberCount = Math.max(0, this.memberCount);
  
  next();
});

module.exports = mongoose.model('Specialty', specialtySchema);
