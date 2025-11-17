// models/Skill.js - VERSION APPWRITE/MONGODB ATLAS
/**
 * Modèle Skill pour Appwrite avec MongoDB Atlas
 * 
 * Note: Dans Appwrite, le schéma est géré par la configuration de la collection
 * Ce fichier sert de référence pour la structure des documents
 */

class Skill {
  constructor(data = {}) {
    this.name = data.name || '';
    this.category = data.category || 'technique';
    this.level = data.level || 'intermédiaire';
    this.description = data.description || '';
    this.memberCount = data.memberCount || 0;
    this.popularity = data.popularity || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Validation des données
  static validate(skillData) {
    const errors = [];

    // Validation du nom
    if (!skillData.name || typeof skillData.name !== 'string' || skillData.name.trim().length < 2) {
      errors.push('Le nom de la compétence est requis et doit contenir au moins 2 caractères');
    }

    // Validation de la catégorie
    const validCategories = ['technique', 'management', 'domaine', 'soft', 'langage', 'outil', 'autre', 'design'];
    if (skillData.category && !validCategories.includes(skillData.category)) {
      errors.push(`Catégorie invalide. Valeurs acceptées: ${validCategories.join(', ')}`);
    }

    // Validation du niveau
    const validLevels = ['débutant', 'intermédiaire', 'avancé', 'expert'];
    if (skillData.level && !validLevels.includes(skillData.level)) {
      errors.push(`Niveau invalide. Valeurs acceptées: ${validLevels.join(', ')}`);
    }

    // Validation du memberCount
    if (skillData.memberCount !== undefined && (isNaN(skillData.memberCount) || skillData.memberCount < 0)) {
      errors.push('Le nombre de membres doit être un nombre positif');
    }

    // Validation de la popularité
    if (skillData.popularity !== undefined && (isNaN(skillData.popularity) || skillData.popularity < 0 || skillData.popularity > 100)) {
      errors.push('La popularité doit être un nombre entre 0 et 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Formater les données pour l'API
  toAPI() {
    return {
      name: this.name.trim(),
      category: this.category,
      level: this.level,
      description: this.description.trim(),
      memberCount: Math.max(0, parseInt(this.memberCount) || 0),
      popularity: Math.min(100, Math.max(0, parseFloat(this.popularity) || 0)),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Mettre à jour les timestamps
  updateTimestamps() {
    this.updatedAt = new Date().toISOString();
    if (!this.createdAt) {
      this.createdAt = this.updatedAt;
    }
  }

  // Calculer la popularité basée sur le nombre de membres
  calculatePopularity(totalMembers = 0) {
    if (totalMembers > 0 && this.memberCount > 0) {
      this.popularity = (this.memberCount / totalMembers) * 100;
    } else {
      this.popularity = 0;
    }
    return this.popularity;
  }

  // Catégoriser automatiquement une compétence basée sur son nom
  static categorizeByName(skillName) {
    const name = skillName.toLowerCase();
    
    const categories = {
      langage: ['javascript', 'python', 'java', 'typescript', 'php', 'ruby', 'go', 'c#', 'c++', 'swift', 'html', 'css', 'sql'],
      technique: ['react', 'angular', 'vue', 'node', 'express', 'django', 'spring', 'docker', 'kubernetes', 'mongodb', 'mysql', 'postgresql'],
      design: ['ui', 'ux', 'design', 'figma', 'photoshop', 'illustrator', 'sketch'],
      outil: ['git', 'jenkins', 'vscode', 'postman', 'jira', 'trello', 'slack'],
      management: ['gestion', 'management', 'leadership', 'projet', 'équipe', 'agile', 'scrum', 'kanban'],
      soft: ['communication', 'créativité', 'adaptabilité', 'résolution', 'empathie', 'collaboration', 'travail d\'équipe'],
      domaine: ['finance', 'marketing', 'rh', 'juridique', 'commercial', 'santé', 'éducation']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'technique';
  }

  // Formater le nom de la compétence
  static formatName(name) {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Générer une description automatique
  static generateDescription(name, category) {
    const descriptions = {
      langage: `Langage de programmation ${name}`,
      technique: `Compétence technique en ${name}`,
      design: `Compétence en design ${name}`,
      outil: `Outil ${name} pour le développement`,
      management: `Compétence en management ${name}`,
      soft: `Compétence comportementale en ${name}`,
      domaine: `Compétence métier en ${name}`,
      autre: `Compétence en ${name}`
    };
    
    return descriptions[category] || `Compétence en ${name}`;
  }
}

// Configuration pour Appwrite
const SKILL_CONFIG = {
  // Structure de la collection dans Appwrite
  collectionSchema: {
    attributes: [
      {
        key: 'name',
        type: 'string',
        size: 255,
        required: true,
        array: false
      },
      {
        key: 'category',
        type: 'string',
        size: 50,
        required: true,
        array: false,
        default: 'technique'
      },
      {
        key: 'level',
        type: 'string',
        size: 50,
        required: false,
        array: false,
        default: 'intermédiaire'
      },
      {
        key: 'description',
        type: 'string',
        size: 1000,
        required: false,
        array: false,
        default: ''
      },
      {
        key: 'memberCount',
        type: 'integer',
        required: true,
        array: false,
        default: 0
      },
      {
        key: 'popularity',
        type: 'double',
        required: true,
        array: false,
        default: 0.0
      }
    ],
    indexes: [
      {
        key: 'name',
        type: 'key',
        attributes: ['name'],
        orders: ['ASC']
      },
      {
        key: 'category',
        type: 'key',
        attributes: ['category'],
        orders: ['ASC']
      },
      {
        key: 'memberCount',
        type: 'key',
        attributes: ['memberCount'],
        orders: ['DESC']
      },
      {
        key: 'popularity',
        type: 'key',
        attributes: ['popularity'],
        orders: ['DESC']
      }
    ]
  },

  // Valeurs par défaut pour les catégories
  categories: [
    'technique', 'management', 'domaine', 'soft', 'langage', 'outil', 'autre', 'design'
  ],

  // Valeurs par défaut pour les niveaux
  levels: [
    'débutant', 'intermédiaire', 'avancé', 'expert'
  ],

  // Configuration des requêtes
  queryConfig: {
    defaultLimit: 100,
    maxLimit: 500,
    sortFields: ['name', 'memberCount', 'popularity', 'category', 'createdAt', 'updatedAt']
  }
};

module.exports = {
  Skill,
  SKILL_CONFIG
};
