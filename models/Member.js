// models/Member.js - VERSION ULTRA-OPTIMISÉE & COMPLÈTE
const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

// 🔹 Schéma principal optimisé
const memberSchema = new mongoose.Schema({
  // ========== INFORMATIONS PERSONNELLES ==========
  name: {
    type: String,
    required: [true, "Le nom est requis"],
    trim: true,
    minlength: [2, "Le nom doit contenir au moins 2 caractères"],
    maxlength: [100, "Le nom ne peut pas dépasser 100 caractères"],
    index: true
  },
  title: {
    type: String,
    required: [true, "Le titre est requis"],
    trim: true,
    maxlength: [200, "Le titre ne peut pas dépasser 200 caractères"],
    index: true
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Veuillez fournir un email valide"],
    index: true
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9\s\-\(\)]{10,}$/, "Numéro de téléphone invalide"]
  },

  // ========== COMPÉTENCES & EXPERTISES ==========
  specialties: {
    type: [String],
    default: [],
    set: function(specialties) {
      // Normalisation automatique des spécialités
      if (Array.isArray(specialties)) {
        return specialties
          .map(s => String(s).trim())
          .filter(s => s && s.length > 0)
          .slice(0, 20); // Limite à 20 spécialités
      }
      return [];
    },
    validate: {
      validator: array => array.length <= 20,
      message: "Maximum 20 spécialités autorisées"
    }
  },
  skills: {
    type: [String],
    default: [],
    set: function(skills) {
      // Normalisation automatique des compétences
      if (Array.isArray(skills)) {
        return skills
          .map(s => String(s).trim())
          .filter(s => s && s.length > 0)
          .slice(0, 30); // Limite à 30 compétences
      }
      return [];
    },
    validate: {
      validator: array => array.length <= 30,
      message: "Maximum 30 compétences autorisées"
    }
  },

  // ========== LOCALISATION & ORGANISATION ==========
  location: {
    type: String,
    trim: true,
    maxlength: [100, "La localisation ne peut pas dépasser 100 caractères"],
    index: true
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [100, "L'organisation ne peut pas dépasser 100 caractères"],
    index: true
  },
  entreprise: {
    type: String,
    trim: true,
    maxlength: [100, "Le nom de l'entreprise ne peut pas dépasser 100 caractères"]
  },

  // ========== EXPÉRIENCE & PROJETS ==========
  experienceYears: {
    type: Number,
    default: 0,
    min: [0, "L'expérience ne peut pas être négative"],
    max: [60, "L'expérience ne peut pas dépasser 60 ans"],
    index: true
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

  // ========== STATUT & MÉTADONNÉES ==========
  statutMembre: {
    type: String,
    enum: ["Actif", "Inactif", "En attente", "Archivé"],
    default: "Actif",
    index: true
  },
  
  // ========== LIENS & FICHIERS ==========
  photo: {
    type: String,
    default: "",
    validate: {
      validator: function(url) {
        if (!url) return true; // URL vide autorisée
        return /^https?:\/\/.+\..+/.test(url) || url.startsWith('/assets/');
      },
      message: "L'URL de la photo doit être valide ou commencer par /assets/"
    }
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

  // ========== GESTION INTERNE ==========
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  importedFrom: {
    type: String,
    enum: ["manual", "csv", "api", "migration", "appwrite"],
    default: "manual"
  },
  sourceId: {
    type: String, // ID original si importé depuis une autre source
    index: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Nettoyer le JSON de sortie
      delete ret.__v;
      delete ret.metadata;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// 🔹 Plugins
memberSchema.plugin(uniqueValidator, { 
  message: "Erreur, {PATH} {VALUE} existe déjà." 
});

// 🔹 Index composites pour performances
memberSchema.index({ 
  isActive: 1, 
  statutMembre: 1,
  location: 1 
});
memberSchema.index({ 
  specialties: 1, 
  isActive: 1 
});
memberSchema.index({ 
  organization: 1, 
  location: 1 
});
memberSchema.index({ 
  createdAt: -1 
});
memberSchema.index({ 
  experienceYears: -1 
});

// 🔹 Index texte pour recherche globale (optimisé)
memberSchema.index({
  name: 'text',
  title: 'text', 
  organization: 'text',
  'specialties': 'text',
  'skills': 'text',
  location: 'text'
}, {
  name: 'member_search_index',
  weights: {
    name: 10,
    title: 5,
    specialties: 3,
    skills: 2,
    organization: 4,
    location: 3
  }
});

// ========== VIRTUAL FIELDS ==========

// 🔹 Niveau d'expérience calculé
memberSchema.virtual('experienceLevel').get(function() {
  const years = this.experienceYears || 0;
  if (years < 2) return "Junior";
  if (years < 5) return "Intermédiaire";
  if (years < 10) return "Senior";
  if (years < 15) return "Expert";
  return "Sénior Expert";
});

// 🔹 Années d'expérience en catégorie
memberSchema.virtual('experienceRange').get(function() {
  const years = this.experienceYears || 0;
  if (years === 0) return "0-1 an";
  if (years <= 2) return "1-2 ans";
  if (years <= 5) return "3-5 ans";
  if (years <= 10) return "6-10 ans";
  if (years <= 15) return "11-15 ans";
  return "15+ ans";
});

// 🔹 URL photo complète
memberSchema.virtual('photoUrl').get(function() {
  if (!this.photo) return '/assets/default-avatar.png';
  if (this.photo.startsWith('http')) return this.photo;
  if (this.photo.startsWith('/assets/')) return this.photo;
  return `/assets/photos/${this.photo}`;
});

// 🔹 Profil complet pour API
memberSchema.virtual('profile').get(function() {
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
    experience: {
      years: this.experienceYears,
      level: this.experienceLevel,
      range: this.experienceRange
    },
    projects: this.projects,
    availability: this.availability,
    status: this.statutMembre,
    photo: this.photoUrl,
    links: {
      cv: this.cvLink,
      linkedin: this.linkedin
    },
    isActive: this.isActive,
    lastActivity: this.lastActivity,
    memberSince: this.createdAt
  };
});

// ========== INSTANCE METHODS ==========

// 🔹 Méthode pour profil public (sans données sensibles)
memberSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    title: this.title,
    specialties: this.specialties,
    skills: this.skills,
    location: this.location,
    organization: this.organization,
    experience: {
      years: this.experienceYears,
      level: this.experienceLevel
    },
    photo: this.photoUrl,
    memberSince: this.createdAt
  };
};

// 🔹 Méthode pour vérifier la disponibilité
memberSchema.methods.isAvailable = function() {
  return this.isActive && 
         this.statutMembre === 'Actif' && 
         this.availability !== 'Indisponible';
};

// 🔹 Méthode pour ajouter une spécialité
memberSchema.methods.addSpecialty = function(specialty) {
  const normalized = String(specialty).trim();
  if (normalized && !this.specialties.includes(normalized)) {
    this.specialties.push(normalized);
    if (this.specialties.length > 20) {
      this.specialties = this.specialties.slice(0, 20);
    }
  }
  return this;
};

// 🔹 Méthode pour ajouter une compétence
memberSchema.methods.addSkill = function(skill) {
  const normalized = String(skill).trim();
  if (normalized && !this.skills.includes(normalized)) {
    this.skills.push(normalized);
    if (this.skills.length > 30) {
      this.skills = this.skills.slice(0, 30);
    }
  }
  return this;
};

// ========== STATIC METHODS ==========

// 🔹 Recherche avancée avec aggregation pipeline (plus performant)
memberSchema.statics.advancedSearch = async function(filters = {}) {
  const {
    search,
    specialties,
    skills,
    organization,
    location,
    minExperience = 0,
    maxExperience = 60,
    experienceLevel,
    status = 'Actif',
    page = 1,
    limit = 12,
    sortBy = 'name',
    sortOrder = 'asc'
  } = filters;

  const MAX_LIMIT = 100;
  const realLimit = Math.min(limit, MAX_LIMIT);
  const skip = (page - 1) * realLimit;

  // Pipeline d'aggregation
  const pipeline = [];
  
  // Étape de matching
  const matchStage = { 
    isActive: true,
    statutMembre: status 
  };

  // Recherche texte
  if (search && search.trim()) {
    matchStage.$text = { $search: search.trim() };
  }

  // Filtres sur tableaux
  if (specialties) {
    matchStage.specialties = { 
      $in: Array.isArray(specialties) ? specialties : [specialties] 
    };
  }

  if (skills) {
    matchStage.skills = { 
      $in: Array.isArray(skills) ? skills : [skills] 
    };
  }

  // Filtres regex
  if (organization) {
    matchStage.organization = { $regex: organization, $options: 'i' };
  }

  if (location) {
    matchStage.location = { $regex: location, $options: 'i' };
  }

  // Filtre expérience
  matchStage.experienceYears = { 
    $gte: minExperience, 
    $lte: maxExperience 
  };

  // Filtre niveau d'expérience
  if (experienceLevel) {
    const levelRanges = {
      'Junior': [0, 2],
      'Intermédiaire': [2, 5],
      'Senior': [5, 10],
      'Expert': [10, 15],
      'Sénior Expert': [15, 60]
    };
    
    if (levelRanges[experienceLevel]) {
      const [min, max] = levelRanges[experienceLevel];
      matchStage.experienceYears.$gte = min;
      matchStage.experienceYears.$lte = max;
    }
  }

  pipeline.push({ $match: matchStage });

  // Tri
  const sortStage = {};
  if (search && search.trim()) {
    // Si recherche texte, tri par score de pertinence
    sortStage.score = { $meta: "textScore" };
  } else {
    // Tri normal
    sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
  }
  pipeline.push({ $sort: sortStage });

  // Pagination
  pipeline.push(
    { $skip: skip },
    { $limit: realLimit },
    { 
      $project: {
        name: 1,
        title: 1,
        email: 1,
        phone: 1,
        specialties: 1,
        skills: 1,
        location: 1,
        organization: 1,
        entreprise: 1,
        experienceYears: 1,
        projects: 1,
        availability: 1,
        statutMembre: 1,
        photo: 1,
        cvLink: 1,
        linkedin: 1,
        isActive: 1,
        lastActivity: 1,
        createdAt: 1,
        updatedAt: 1,
        experienceLevel: { $ifNull: ["$experienceLevel", "Non spécifié"] },
        photoUrl: {
          $cond: {
            if: { $eq: ["$photo", ""] },
            then: "/assets/default-avatar.png",
            else: {
              $cond: {
                if: { $regexMatch: { input: "$photo", regex: "^https?://" } },
                then: "$photo",
                else: { $concat: ["/assets/photos/", "$photo"] }
              }
            }
          }
        }
      }
    }
  );

  // Exécution en parallèle pour count + data
  const [data, total] = await Promise.all([
    this.aggregate(pipeline),
    this.countDocuments(matchStage)
  ]);

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: realLimit,
      total,
      totalPages: Math.ceil(total / realLimit),
      hasNext: page * realLimit < total,
      hasPrev: page > 1
    },
    filters: {
      search,
      specialties,
      skills,
      organization,
      location,
      minExperience,
      maxExperience,
      experienceLevel,
      status
    }
  };
};

// 🔹 Statistiques agrégées
memberSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $facet: {
        // Total par statut
        statusStats: [
          { $group: { _id: "$statutMembre", count: { $sum: 1 } } }
        ],
        // Total par localisation (top 10)
        locationStats: [
          { $match: { location: { $ne: "" } } },
          { $group: { _id: "$location", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        // Total par organisation (top 10)
        organizationStats: [
          { $match: { organization: { $ne: "" } } },
          { $group: { _id: "$organization", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        // Spécialités les plus courantes
        specialtyStats: [
          { $unwind: "$specialties" },
          { $group: { _id: "$specialties", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 15 }
        ],
        // Compétences les plus courantes
        skillStats: [
          { $unwind: "$skills" },
          { $group: { _id: "$skills", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 15 }
        ],
        // Expérience moyenne
        experienceStats: [
          {
            $group: {
              _id: null,
              avgExperience: { $avg: "$experienceYears" },
              maxExperience: { $max: "$experienceYears" },
              minExperience: { $min: "$experienceYears" },
              totalMembers: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  return stats[0];
};

// 🔹 Recherche de similarités (pour recommandations)
memberSchema.statics.findSimilarMembers = async function(memberId, limit = 5) {
  const member = await this.findById(memberId);
  if (!member) return [];

  return this.aggregate([
    { $match: { 
      _id: { $ne: member._id },
      isActive: true,
      statutMembre: 'Actif'
    }},
    {
      $addFields: {
        similarityScore: {
          $add: [
            { $size: { $setIntersection: ["$specialties", member.specialties] } },
            { $size: { $setIntersection: ["$skills", member.skills] } },
            { $cond: [{ $eq: ["$organization", member.organization] }, 2, 0] },
            { $cond: [{ $eq: ["$location", member.location] }, 1, 0] }
          ]
        }
      }
    },
    { $match: { similarityScore: { $gt: 0 } } },
    { $sort: { similarityScore: -1 } },
    { $limit: limit },
    {
      $project: {
        name: 1,
        title: 1,
        specialties: 1,
        skills: 1,
        organization: 1,
        location: 1,
        experienceYears: 1,
        photoUrl: 1,
        similarityScore: 1
      }
    }
  ]);
};

// ========== MIDDLEWARE ==========

// 🔹 Pre-save: Nettoyage et validation avancée
memberSchema.pre('save', function(next) {
  // Capitaliser le nom
  if (this.name) {
    this.name = this.name
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Mettre à jour lastActivity
  this.lastActivity = new Date();

  // Normaliser les URLs
  if (this.photo && !this.photo.startsWith('http') && !this.photo.startsWith('/assets/')) {
    this.photo = `/assets/photos/${this.photo}`;
  }

  next();
});

// 🔹 Post-save: Mise à jour des statistiques
memberSchema.post('save', function(doc) {
  console.log(`✅ Membre sauvegardé: ${doc.name} (${doc._id})`);
});

// 🔹 Pre-remove: Log de suppression
memberSchema.pre('remove', function(next) {
  console.log(`🗑️  Suppression du membre: ${this.name} (${this._id})`);
  next();
});

module.exports = mongoose.model("Member", memberSchema);
