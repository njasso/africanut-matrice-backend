// models/Member.js - VERSION OPTIMISÉE
const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Le nom est requis"],
    trim: true,
    minlength: [2, "Le nom doit contenir au moins 2 caractères"],
    maxlength: [100, "Le nom ne peut pas dépasser 100 caractères"]
  },
  title: {
    type: String,
    required: [true, "Le titre est requis"],
    trim: true,
    maxlength: [200, "Le titre ne peut pas dépasser 200 caractères"]
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Veuillez fournir un email valide"]
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9\s\-\(\)]{10,}$/, "Numéro de téléphone invalide"]
  },
  specialties: {
    type: [String],
    default: [],
    validate: {
      validator: function(array) {
        return array.length <= 20; // Maximum 20 spécialités
      },
      message: "Maximum 20 spécialités autorisées"
    }
  },
  skills: {
    type: [String],
    default: [],
    validate: {
      validator: function(array) {
        return array.length <= 30; // Maximum 30 compétences
      },
      message: "Maximum 30 compétences autorisées"
    }
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, "La localisation ne peut pas dépasser 100 caractères"]
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [100, "L'organisation ne peut pas dépasser 100 caractères"]
  },
  entreprise: {
    type: String,
    trim: true,
    maxlength: [100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"]
  },
  experienceYears: {
    type: Number,
    default: 0,
    min: [0, "L'expérience ne peut pas être négative"],
    max: [60, "L'expérience ne peut pas dépasser 60 ans"]
  },
  projects: {
    type: String,
    default: "",
    maxlength: [1000, "La description des projets ne peut pas dépasser 1000 caractères"]
  },
  availability: {
    type: String,
    default: "",
    maxlength: [200, "La disponibilité ne peut pas dépasser 200 caractères"]
  },
  statutMembre: {
    type: String,
    enum: ["Actif", "Inactif", "En attente"],
    default: "Actif"
  },
  photo: {
    type: String,
    default: "",
    match: [/^https?:\/\/.+\..+/, "L'URL de la photo doit être valide"]
  },
  cvLink: {
    type: String,
    default: "",
    match: [/^https?:\/\/.+\..+/, "L'URL du CV doit être valide"]
  },
  linkedin: {
    type: String,
    default: "",
    match: [/^https?:\/\/.+\..+/, "L'URL LinkedIn doit être valide"]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  importedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔹 Index pour les recherches rapides
memberSchema.index({ name: 'text', title: 'text', organization: 'text' });
memberSchema.index({ email: 1 });
memberSchema.index({ specialties: 1 });
memberSchema.index({ organization: 1 });
memberSchema.index({ location: 1 });
memberSchema.index({ isActive: 1 });

// 🔹 Virtual pour l'expérience en catégories
memberSchema.virtual('experienceLevel').get(function() {
  if (this.experienceYears < 2) return "Débutant";
  if (this.experienceYears < 5) return "Intermédiaire";
  if (this.experienceYears < 10) return "Confirmé";
  return "Expert";
});

// 🔹 Méthode d'instance pour le profil complet
memberSchema.methods.getProfile = function() {
  return {
    id: this._id,
    name: this.name,
    title: this.title,
    email: this.email,
    phone: this.phone,
    specialties: this.specialties,
    skills: this.skills,
    location: this.location,
    organization: this.organization,
    entreprise: this.entreprise,
    experienceYears: this.experienceYears,
    experienceLevel: this.experienceLevel,
    projects: this.projects,
    availability: this.availability,
    statutMembre: this.statutMembre,
    photo: this.photo,
    cvLink: this.cvLink,
    linkedin: this.linkedin,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// 🔹 Méthode statique pour les recherches avancées
memberSchema.statics.searchMembers = function(filters = {}) {
  const {
    search,
    specialties,
    organization,
    location,
    minExperience,
    maxExperience,
    page = 1,
    limit = 12,
    sort = 'name'
  } = filters;

  let query = { isActive: true };

  // Recherche texte
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { organization: { $regex: search, $options: 'i' } },
      { specialties: { $in: [new RegExp(search, 'i')] } },
      { skills: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Filtres spécifiques
  if (specialties) {
    query.specialties = { $in: Array.isArray(specialties) ? specialties : [specialties] };
  }

  if (organization) {
    query.organization = { $regex: organization, $options: 'i' };
  }

  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }

  // Filtre expérience
  if (minExperience !== undefined || maxExperience !== undefined) {
    query.experienceYears = {};
    if (minExperience !== undefined) query.experienceYears.$gte = minExperience;
    if (maxExperience !== undefined) query.experienceYears.$lte = maxExperience;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort({ [sort]: 1 })
    .skip(skip)
    .limit(limit);
};

// 🔹 Middleware pre-save pour nettoyer les données
memberSchema.pre('save', function(next) {
  // Nettoyer les tableaux (supprimer les valeurs vides)
  if (this.specialties) {
    this.specialties = this.specialties
      .map(s => s.trim())
      .filter(s => s !== '');
  }

  if (this.skills) {
    this.skills = this.skills
      .map(s => s.trim())
      .filter(s => s !== '');
  }

  // Capitaliser le nom
  if (this.name) {
    this.name = this.name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  next();
});

module.exports = mongoose.model("Member", memberSchema);
