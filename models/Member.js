// models/Member.js - VERSION CORRIGÉE
const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

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
  // 🔹 CORRECTION : Référence au modèle Specialty
  specialties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialty',
    validate: {
      validator: array => array.length <= 20,
      message: "Maximum 20 spécialités autorisées"
    }
  }],
  skills: {
    type: [String],
    default: [],
    validate: {
      validator: array => array.length <= 30,
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

// 🔹 Plugins
memberSchema.plugin(uniqueValidator, { message: "Erreur, {PATH} doit être unique." });

// 🔹 Index pour les spécialités (référence ObjectId)
memberSchema.index({ specialties: 1 });
memberSchema.index({ email: 1 });
memberSchema.index({ isActive: 1 });

// 🔹 Virtual pour l'expérience en catégories
memberSchema.virtual('experienceLevel').get(function() {
  if (this.experienceYears < 2) return "Débutant";
  if (this.experienceYears < 5) return "Intermédiaire";
  if (this.experienceYears < 10) return "Confirmé";
  return "Expert";
});

// 🔹 Virtual pour compter les spécialités
memberSchema.virtual('specialtiesCount').get(function() {
  return this.specialties ? this.specialties.length : 0;
});

// 🔹 Méthode d'instance pour le profil complet avec populate
memberSchema.methods.getProfile = async function() {
  await this.populate('specialties');
  
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
    updatedAt: this.updatedAt,
    specialtiesCount: this.specialtiesCount
  };
};

// 🔹 Méthode pour ajouter une spécialité
memberSchema.methods.addSpecialty = async function(specialtyId) {
  if (!this.specialties.includes(specialtyId)) {
    this.specialties.push(specialtyId);
    await this.save();
    
    // Mettre à jour le compteur de la spécialité
    const Specialty = mongoose.model('Specialty');
    await Specialty.findByIdAndUpdate(specialtyId, { 
      $inc: { memberCount: 1 } 
    });
  }
  return this;
};

// 🔹 Méthode pour supprimer une spécialité
memberSchema.methods.removeSpecialty = async function(specialtyId) {
  const index = this.specialties.indexOf(specialtyId);
  if (index > -1) {
    this.specialties.splice(index, 1);
    await this.save();
    
    // Mettre à jour le compteur de la spécialité
    const Specialty = mongoose.model('Specialty');
    await Specialty.findByIdAndUpdate(specialtyId, { 
      $inc: { memberCount: -1 } 
    });
  }
  return this;
};

// 🔹 Méthode statique pour recherches avancées avec populate
memberSchema.statics.searchMembers = async function(filters = {}) {
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

  const MAX_LIMIT = 50;
  const realLimit = Math.min(limit, MAX_LIMIT);
  const skip = (page - 1) * realLimit;

  let query = { isActive: true };

  // Recherche texte
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
      { organization: { $regex: search, $options: 'i' } }
    ];
  }

  // Filtres spécifiques
  if (specialties) {
    if (Array.isArray(specialties)) {
      query.specialties = { $in: specialties };
    } else {
      query.specialties = specialties;
    }
  }
  if (organization) query.organization = { $regex: organization, $options: 'i' };
  if (location) query.location = { $regex: location, $options: 'i' };

  // Filtre expérience
  const expFilter = {};
  if (minExperience != null) expFilter.$gte = minExperience;
  if (maxExperience != null) expFilter.$lte = maxExperience;
  if (Object.keys(expFilter).length) query.experienceYears = expFilter;

  let sortObj = { [sort]: 1 };

  const members = await this.find(query)
             .populate('specialties')
             .sort(sortObj)
             .skip(skip)
             .limit(realLimit);

  return members;
};

// 🔹 Méthode statique pour obtenir les membres avec leurs spécialités complètes
memberSchema.statics.getMembersWithSpecialties = function() {
  return this.find({ isActive: true })
             .populate('specialties')
             .exec();
};

// 🔹 Méthode statique pour compter les membres par spécialité
memberSchema.statics.countBySpecialty = function(specialtyId) {
  return this.countDocuments({ 
    specialties: specialtyId, 
    isActive: true 
  });
};

// 🔹 Middleware pre-save pour nettoyage
memberSchema.pre('save', function(next) {
  // Nettoyer les compétences (skills restent en String)
  if (this.skills) this.skills = this.skills.map(s => s.trim()).filter(s => s);

  // Capitaliser le nom
  if (this.name) this.name = this.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  // Normaliser title et organization
  if (this.title) this.title = this.title.trim();
  if (this.organization) this.organization = this.organization.trim();

  next();
});

module.exports = mongoose.model("Member", memberSchema);
