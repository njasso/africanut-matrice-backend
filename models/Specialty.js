// models/Specialty.js - Version MongoDB/Mongoose
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

// Index pour optimiser les recherches
specialtySchema.index({ category: 1, popularity: -1 });
specialtySchema.index({ tags: 1 });
specialtySchema.index({ isActive: 1 });

// Méthodes d'instance
specialtySchema.methods = {
  // Validation des données (méthode supplémentaire)
  validateData() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Le nom de la spécialité est requis');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Le nom ne peut pas dépasser 100 caractères');
    }

    if (this.memberCount < 0) {
      errors.push('Le nombre de membres ne peut pas être négatif');
    }

    if (this.popularity < 0 || this.popularity > 100) {
      errors.push('La popularité doit être entre 0 et 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Incrémenter le compteur de membres
  incrementMemberCount(count = 1) {
    this.memberCount += count;
    return this.save();
  },

  // Décrémenter le compteur de membres
  decrementMemberCount(count = 1) {
    this.memberCount = Math.max(0, this.memberCount - count);
    return this.save();
  },

  // Calculer la popularité basée sur le nombre de membres et le total des membres
  calculatePopularity(totalMembers) {
    if (totalMembers > 0) {
      this.popularity = (this.memberCount / totalMembers) * 100;
    } else {
      this.popularity = 0;
    }
    return this.save();
  },

  // Ajouter un tag
  addTag(tag) {
    if (tag && tag.trim() && !this.tags.includes(tag.trim())) {
      this.tags.push(tag.trim());
      return this.save();
    }
    return Promise.resolve(this);
  },

  // Supprimer un tag
  removeTag(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    return this.save();
  },

  // Vérifier si la spécialité est populaire (seuil à 20%)
  isPopular() {
    return this.popularity >= 20;
  },

  // Vérifier si la spécialité est rare (seuil à 5%)
  isRare() {
    return this.popularity <= 5 && this.popularity > 0;
  },

  // Obtenir les statistiques de base
  getStats() {
    return {
      memberCount: this.memberCount,
      popularity: this.popularity,
      isPopular: this.isPopular(),
      isRare: this.isRare(),
      hasMembers: this.memberCount > 0,
      tagsCount: this.tags.length
    };
  },

  // Formater pour l'affichage (méthode virtuelle)
  toJSON() {
    const obj = this.toObject();
    obj.id = obj._id;
    obj.stats = this.getStats();
    delete obj._id;
    delete obj.__v;
    return obj;
  }
};

// Méthodes statiques
specialtySchema.statics = {
  // Trouver par catégorie
  findByCategory(category) {
    return this.find({ category, isActive: true });
  },

  // Trouver les spécialités populaires
  findPopular() {
    return this.find({ popularity: { $gte: 20 }, isActive: true });
  },

  // Trouver les spécialités rares
  findRare() {
    return this.find({ 
      popularity: { $lte: 5, $gt: 0 }, 
      isActive: true 
    });
  },

  // Trouver par tags
  findByTags(tags) {
    return this.find({ 
      tags: { $in: tags },
      isActive: true 
    });
  },

  // Compter les spécialités par catégorie
  countByCategory() {
    return this.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalMembers: { $sum: '$memberCount' },
          avgPopularity: { $avg: '$popularity' }
        }
      }
    ]);
  },

  // Obtenir les statistiques globales
  getGlobalStats() {
    return this.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalSpecialties: { $sum: 1 },
          totalMembers: { $sum: '$memberCount' },
          avgMembersPerSpecialty: { $avg: '$memberCount' },
          maxPopularity: { $max: '$popularity' },
          minPopularity: { $min: '$popularity' },
          avgPopularity: { $avg: '$popularity' }
        }
      }
    ]);
  },

  // Mettre à jour les popularités basées sur le total des membres
  async updateAllPopularities(totalMembers) {
    if (totalMembers <= 0) return;

    const specialties = await this.find({ isActive: true });
    const updatePromises = specialties.map(specialty => {
      specialty.popularity = (specialty.memberCount / totalMembers) * 100;
      return specialty.save();
    });

    return Promise.all(updatePromises);
  }
};

// Middleware pre-save pour la validation et le nettoyage
specialtySchema.pre('save', function(next) {
  // Nettoyer le nom
  if (this.name) {
    this.name = this.name.trim();
  }

  // S'assurer que la popularité est dans les limites
  this.popularity = Math.max(0, Math.min(100, this.popularity));

  // S'assurer que memberCount n'est pas négatif
  this.memberCount = Math.max(0, this.memberCount);

  // Nettoyer les tags
  if (this.tags) {
    this.tags = this.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    // Supprimer les doublons
    this.tags = [...new Set(this.tags)];
  }

  next();
});

// Helper functions pour la gestion des spécialités
class SpecialtyHelper {
  // Catégoriser automatiquement une spécialité basée sur son nom
  static categorizeSpecialty(specialtyName) {
    if (!specialtyName || typeof specialtyName !== 'string') return 'autre';
    
    const name = specialtyName.toLowerCase();
    
    const categories = {
      technique: [
        'technique', 'ingénieur', 'technolog', 'informatique', 'digital', 'software', 
        'hardware', 'code', 'programmation', 'développement', 'coding', 'algorithm', 
        'data', 'ai', 'intelligence artificielle', 'robotique', 'automatisation'
      ],
      management: [
        'gestion', 'management', 'leadership', 'projet', 'équipe', 'qualité', 
        'sécurité', 'admin', 'coordination', 'supervision', 'stratégie', 
        'planification', 'organisation', 'direction'
      ],
      industrie: [
        'industrie', 'production', 'manufactur', 'usine', 'fabrication', 'process', 
        'opération', 'maintenance', 'industriel', 'production', 'manufacturing',
        'usinage', 'assemblage'
      ],
      recherche: [
        'recherche', 'développement', 'r&d', 'innovation', 'scientifique', 'étude', 
        'analyse', 'laboratoire', 'expérimentation', 'science', 'académique', 
        'publication', 'thèse', 'doctorat'
      ],
      environnement: [
        'environnement', 'écolog', 'durable', 'climat', 'biodiversité', 'conservation', 
        'nature', 'écologique', 'green', 'sustainable', 'écologie', 'carbone'
      ],
      energie: [
        'énergie', 'solaire', 'éolien', 'hydraulique', 'renouvelable', 'nucléaire', 
        'thermique', 'électricité', 'power', 'grid', 'smart grid', 'énergie'
      ]
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'autre';
  }

  // Filtrer les spécialités par catégorie
  static filterByCategory(specialties, category) {
    return specialties.filter(specialty => specialty.category === category);
  }

  // Trier les spécialités par popularité
  static sortByPopularity(specialties, ascending = false) {
    return specialties.sort((a, b) => {
      return ascending ? a.popularity - b.popularity : b.popularity - a.popularity;
    });
  }

  // Trier les spécialités par nombre de membres
  static sortByMemberCount(specialties, ascending = false) {
    return specialties.sort((a, b) => {
      return ascending ? a.memberCount - b.memberCount : b.memberCount - a.memberCount;
    });
  }

  // Obtenir les statistiques globales des spécialités
  static getGlobalStats(specialties) {
    const totalSpecialties = specialties.length;
    const totalMembers = specialties.reduce((sum, specialty) => sum + specialty.memberCount, 0);
    const avgMembersPerSpecialty = totalSpecialties > 0 ? totalMembers / totalSpecialties : 0;
    
    const categoryStats = {};
    specialties.forEach(specialty => {
      const category = specialty.category;
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          totalMembers: 0,
          avgPopularity: 0
        };
      }
      categoryStats[category].count++;
      categoryStats[category].totalMembers += specialty.memberCount;
    });

    // Calculer la popularité moyenne par catégorie
    Object.keys(categoryStats).forEach(category => {
      const categorySpecialties = specialties.filter(s => s.category === category);
      categoryStats[category].avgPopularity = categorySpecialties.length > 0 
        ? categorySpecialties.reduce((sum, s) => sum + s.popularity, 0) / categorySpecialties.length
        : 0;
    });

    return {
      totalSpecialties,
      totalMembers,
      avgMembersPerSpecialty: Math.round(avgMembersPerSpecialty * 100) / 100,
      categoryStats,
      mostPopularSpecialty: specialties.length > 0 
        ? SpecialtyHelper.sortByPopularity(specialties)[0] 
        : null,
      leastPopularSpecialty: specialties.length > 0 
        ? SpecialtyHelper.sortByPopularity(specialties, true)[0] 
        : null
    };
  }
}

module.exports = {
  Specialty: mongoose.model('Specialty', specialtySchema),
  SpecialtyHelper
};
