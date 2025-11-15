// models/Member.js
const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Le nom est requis"],
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  specialties: {
    type: [String],
    default: []
  },
  skills: {
    type: [String],
    default: []
  },
  location: {
    type: String,
    trim: true
  },
  organization: {
    type: String,
    trim: true
  },
  entreprise: {
    type: String,
    trim: true
  },
  experienceYears: {
    type: Number,
    default: 0
  },
  projects: {
    type: String,
    default: ""
  },
  availability: {
    type: String,
    default: ""
  },
  statutMembre: {
    type: String,
    enum: ["Actif", "Inactif", "En attente"],
    default: "Actif"
  },
  photo: {
    type: String,
    default: ""
  },
  cvLink: {
    type: String,
    default: ""
  },
  linkedin: {
    type: String,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Member", memberSchema);
