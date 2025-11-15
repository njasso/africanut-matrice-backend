// models/Skill.js - VERSION CORRIGÉE
const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['technique', 'management', 'domaine', 'soft', 'langage', 'outil', 'autre', 'design'],
    default: 'technique'
  },
  level: {
    type: String,
    enum: ['débutant', 'intermédiaire', 'avancé', 'expert'],
    default: 'intermédiaire'
  },
  description: {
    type: String,
    trim: true,
    default: ''
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
  }
}, {
  timestamps: true
});

// Index pour optimiser les recherches
skillSchema.index({ name: 1 });
skillSchema.index({ category: 1 });
skillSchema.index({ memberCount: -1 });
skillSchema.index({ popularity: -1 });

// Méthode pour formater les données
skillSchema.methods.toJSON = function() {
  const skill = this.toObject();
  skill.id = skill._id;
  delete skill._id;
  delete skill.__v;
  return skill;
};

module.exports = mongoose.model('Skill', skillSchema);