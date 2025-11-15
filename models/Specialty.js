// models/Specialty.js
const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
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
    default: 0
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

module.exports = mongoose.model('Specialty', specialtySchema);