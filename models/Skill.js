// services/skillService.js - Service pour gérer les compétences avec Appwrite
const { databases, ID, Query } = require('node-appwrite');
const { Skill, SKILL_CONFIG } = require('../models/Skill');

class SkillService {
  constructor(databaseId, collectionId) {
    this.databaseId = databaseId;
    this.collectionId = collectionId;
  }

  // Créer une compétence
  async create(skillData) {
    try {
      // Validation des données
      const validation = Skill.validate(skillData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Créer l'instance Skill
      const skill = new Skill(skillData);
      skill.updateTimestamps();

      // Préparer les données pour Appwrite
      const documentData = skill.toAPI();

      // Créer le document dans Appwrite
      const result = await databases.createDocument(
        this.databaseId,
        this.collectionId,
        ID.unique(),
        documentData
      );

      return {
        success: true,
        data: result,
        message: 'Compétence créée avec succès'
      };
    } catch (error) {
      console.error('Erreur création compétence:', error);
      return {
        success: false,
        error: error.message,
        message: 'Erreur lors de la création de la compétence'
      };
    }
  }

  // Récupérer une compétence par ID
  async getById(skillId) {
    try {
      const skill = await databases.getDocument(
        this.databaseId,
        this.collectionId,
        skillId
      );

      return {
        success: true,
        data: skill
      };
    } catch (error) {
      if (error.code === 404) {
        return {
          success: false,
          error: 'Compétence non trouvée',
          code: 404
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Récupérer les compétences avec filtres
  async list(filters = {}) {
    try {
      const {
        limit = SKILL_CONFIG.queryConfig.defaultLimit,
        sort = 'memberCountDesc',
        category,
        search
      } = filters;

      const queries = [];

      // Filtre par catégorie
      if (category && category !== 'all') {
        queries.push(Query.equal('category', category));
      }

      // Filtre par recherche
      if (search) {
        queries.push(Query.search('name', search));
      }

      // Tri
      switch(sort) {
        case 'name':
          queries.push(Query.orderAsc('name'));
          break;
        case '-name':
          queries.push(Query.orderDesc('name'));
          break;
        case 'memberCount':
          queries.push(Query.orderAsc('memberCount'));
          break;
        case '-memberCount':
        default:
          queries.push(Query.orderDesc('memberCount'));
          break;
      }

      // Limite
      const actualLimit = Math.min(parseInt(limit), SKILL_CONFIG.queryConfig.maxLimit);
      queries.push(Query.limit(actualLimit));

      const response = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        queries
      );

      return {
        success: true,
        data: response.documents,
        total: response.total
      };
    } catch (error) {
      console.error('Erreur liste compétences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Mettre à jour une compétence
  async update(skillId, updateData) {
    try {
      // Validation partielle des données
      if (updateData.name) {
        const nameValidation = Skill.validate({ name: updateData.name });
        if (!nameValidation.isValid) {
          throw new Error(nameValidation.errors.join(', '));
        }
        updateData.name = Skill.formatName(updateData.name);
      }

      // Ajouter le timestamp de mise à jour
      updateData.updatedAt = new Date().toISOString();

      const updatedSkill = await databases.updateDocument(
        this.databaseId,
        this.collectionId,
        skillId,
        updateData
      );

      return {
        success: true,
        data: updatedSkill,
        message: 'Compétence mise à jour avec succès'
      };
    } catch (error) {
      if (error.code === 404) {
        return {
          success: false,
          error: 'Compétence non trouvée',
          code: 404
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Supprimer une compétence
  async delete(skillId) {
    try {
      await databases.deleteDocument(
        this.databaseId,
        this.collectionId,
        skillId
      );

      return {
        success: true,
        message: 'Compétence supprimée avec succès'
      };
    } catch (error) {
      if (error.code === 404) {
        return {
          success: false,
          error: 'Compétence non trouvée',
          code: 404
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Synchroniser les compétences avec les membres
  async syncFromMembers(members) {
    try {
      const skillMap = new Map();
      const results = {
        created: 0,
        updated: 0,
        errors: []
      };

      // Analyser les compétences des membres
      members.forEach(member => {
        if (member.skills && Array.isArray(member.skills)) {
          member.skills.forEach(skillName => {
            if (skillName && typeof skillName === 'string' && skillName.trim()) {
              const name = Skill.formatName(skillName.trim());
              const key = name.toLowerCase();
              
              if (!skillMap.has(key)) {
                skillMap.set(key, {
                  name: name,
                  memberCount: 0,
                  category: Skill.categorizeByName(name)
                });
              }
              skillMap.get(key).memberCount++;
            }
          });
        }
      });

      // Récupérer les compétences existantes
      const existingSkills = await databases.listDocuments(
        this.databaseId,
        this.collectionId
      );

      const existingSkillsMap = new Map();
      existingSkills.documents.forEach(skill => {
        existingSkillsMap.set(skill.name.toLowerCase(), skill);
      });

      // Synchroniser
      for (const [key, data] of skillMap) {
        try {
          if (data.name.length < 2) continue;

          const existingSkill = existingSkillsMap.get(key);

          if (existingSkill) {
            // Mettre à jour
            await this.update(existingSkill.$id, {
              memberCount: data.memberCount,
              category: data.category,
              popularity: (data.memberCount / members.length) * 100
            });
            results.updated++;
          } else {
            // Créer
            await this.create({
              name: data.name,
              category: data.category,
              memberCount: data.memberCount,
              popularity: (data.memberCount / members.length) * 100,
              description: Skill.generateDescription(data.name, data.category)
            });
            results.created++;
          }
        } catch (error) {
          results.errors.push(`Erreur avec ${data.name}: ${error.message}`);
        }
      }

      return {
        success: true,
        stats: results
      };
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SkillService;
