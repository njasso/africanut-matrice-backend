const express = require('express');
const router = express.Router();
const { Databases, ID, Query } = require('node-appwrite');
const mongoose = require('mongoose');

// 🔥 Configuration AppWrite
const client = new require('node-appwrite').Client();
const databases = new Databases(client);

// Initialisation du client AppWrite
client
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

// 🔥 Configuration des collections
const DB_ID = process.env.APPWRITE_DATABASE_ID || 'matrice';
const PROJECTS_COLLECTION = process.env.APPWRITE_PROJECTS_COLLECTION || 'projects';
const MEMBERS_COLLECTION = process.env.APPWRITE_MEMBERS_COLLECTION || 'members';

// 🔥 Fonction utilitaire pour gérer les erreurs AppWrite
const handleAppWriteError = (error, res) => {
  console.error('❌ Erreur AppWrite:', error);
  
  if (error.code === 404) {
    return res.status(404).json({
      success: false,
      message: 'Ressource non trouvée'
    });
  }
  
  if (error.code === 401) {
    return res.status(401).json({
      success: false,
      message: 'Non autorisé'
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'Erreur serveur AppWrite',
    error: error.message
  });
};

// 🔥 GET tous les projets avec filtres et pagination
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 12 } = req.query;
    
    console.log('📡 GET /projects - Query:', req.query);
    
    // Construction des queries AppWrite
    const queries = [];
    
    // Filtre par statut
    if (status && status !== 'all') {
      queries.push(Query.equal('status', status));
    }
    
    // Filtre de recherche
    if (search) {
      queries.push(
        Query.or([
          Query.search('title', search),
          Query.search('description', search),
          Query.search('organization', search),
          Query.search('tags', search)
        ])
      );
    }
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    
    // Tri par date de création décroissante
    queries.push(Query.orderDesc('$createdAt'));
    
    // Limite et offset
    queries.push(Query.limit(limitNum));
    queries.push(Query.offset(offset));
    
    console.log('🔍 AppWrite Queries:', queries.length);
    
    const projects = await databases.listDocuments(
      DB_ID,
      PROJECTS_COLLECTION,
      queries
    );
    
    // Récupérer le total pour la pagination
    const totalQueries = queries.filter(q => 
      !q.includes('limit') && !q.includes('offset') && !q.includes('order')
    );
    
    const totalResponse = await databases.listDocuments(
      DB_ID,
      PROJECTS_COLLECTION,
      totalQueries
    );
    
    const total = totalResponse.total;
    
    // 🔥 Populer les données des membres
    const populatedProjects = await Promise.all(
      projects.documents.map(async (project) => {
        if (project.members && project.members.length > 0) {
          try {
            const memberPromises = project.members.map(memberId =>
              databases.getDocument(DB_ID, MEMBERS_COLLECTION, memberId)
                .catch(err => {
                  console.warn(`⚠️ Membre non trouvé: ${memberId}`, err.message);
                  return null;
                })
            );
            
            const members = await Promise.all(memberPromises);
            project.membersData = members.filter(m => m !== null);
          } catch (error) {
            console.error('❌ Erreur population membres:', error);
            project.membersData = [];
          }
        } else {
          project.membersData = [];
        }
        return project;
      })
    );
    
    res.json({
      success: true,
      projects: populatedProjects,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
    
  } catch (error) {
    handleAppWriteError(error, res);
  }
});

// 🔥 GET un projet par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📡 GET /projects/:id', id);
    
    // Validation basique de l'ID
    if (!id || id.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'ID de projet invalide'
      });
    }
    
    const project = await databases.getDocument(
      DB_ID,
      PROJECTS_COLLECTION,
      id
    );
    
    // 🔥 Populer les données des membres
    if (project.members && project.members.length > 0) {
      try {
        const memberPromises = project.members.map(memberId =>
          databases.getDocument(DB_ID, MEMBERS_COLLECTION, memberId)
            .catch(err => {
              console.warn(`⚠️ Membre non trouvé: ${memberId}`, err.message);
              return null;
            })
        );
        
        const members = await Promise.all(memberPromises);
        project.membersData = members.filter(m => m !== null);
      } catch (error) {
        console.error('❌ Erreur population membres:', error);
        project.membersData = [];
      }
    } else {
      project.membersData = [];
    }
    
    res.json({
      success: true,
      project
    });
    
  } catch (error) {
    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }
    handleAppWriteError(error, res);
  }
});

// 🔥 POST créer un nouveau projet
router.post('/', async (req, res) => {
  try {
    const { title, description, members, status, organization, tags } = req.body;
    
    console.log('📤 POST /projects - Data:', { title, organization, status });
    
    // Validation des champs requis
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le titre du projet est requis'
      });
    }
    
    // Vérifier les doublons (titre similaire)
    try {
      const existingProjects = await databases.listDocuments(
        DB_ID,
        PROJECTS_COLLECTION,
        [
          Query.search('title', title.trim())
        ]
      );
      
      if (existingProjects.total > 0) {
        return res.status(409).json({
          success: false,
          message: 'Un projet avec un titre similaire existe déjà'
        });
      }
    } catch (error) {
      // Continuer si la recherche échoue
      console.warn('⚠️ Recherche doublons échouée:', error.message);
    }
    
    // Nettoyer et valider les données
    const cleanTitle = title.trim().substring(0, 100);
    const cleanDescription = description ? description.trim().substring(0, 500) : '';
    const cleanOrganization = organization ? organization.trim().substring(0, 100) : '';
    
    // Préparer les tags
    let cleanTags = [];
    if (tags) {
      if (Array.isArray(tags)) {
        cleanTags = tags.map(tag => tag.toString().trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      } else if (typeof tags === 'string') {
        cleanTags = tags.split(',')
          .map(tag => tag.trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      }
    }
    
    // Valider les membres
    let cleanMembers = [];
    if (members && Array.isArray(members)) {
      // Vérifier que les membres existent
      const memberPromises = members.map(memberId =>
        databases.getDocument(DB_ID, MEMBERS_COLLECTION, memberId)
          .then(() => memberId)
          .catch(() => null)
      );
      
      const validMembers = await Promise.all(memberPromises);
      cleanMembers = validMembers.filter(memberId => memberId !== null);
    }
    
    // Données du projet
    const projectData = {
      title: cleanTitle,
      description: cleanDescription,
      members: cleanMembers,
      status: ['idea', 'active', 'completed', 'archived'].includes(status) ? status : 'idea',
      organization: cleanOrganization,
      tags: cleanTags,
      importedFromMember: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('💾 Création projet:', projectData);
    
    const project = await databases.createDocument(
      DB_ID,
      PROJECTS_COLLECTION,
      ID.unique(),
      projectData
    );
    
    // 🔥 Populer les données des membres pour la réponse
    if (project.members && project.members.length > 0) {
      try {
        const memberPromises = project.members.map(memberId =>
          databases.getDocument(DB_ID, MEMBERS_COLLECTION, memberId)
            .catch(() => null)
        );
        
        const members = await Promise.all(memberPromises);
        project.membersData = members.filter(m => m !== null);
      } catch (error) {
        console.error('❌ Erreur population membres:', error);
        project.membersData = [];
      }
    } else {
      project.membersData = [];
    }
    
    res.status(201).json({
      success: true,
      message: 'Projet créé avec succès',
      project
    });
    
  } catch (error) {
    console.error('❌ Erreur POST /projects:', error);
    
    if (error.code === 409) {
      return res.status(409).json({
        success: false,
        message: 'Conflit de données'
      });
    }
    
    handleAppWriteError(error, res);
  }
});

// 🔥 PUT modifier un projet
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, members, status, organization, tags } = req.body;
    
    console.log('📤 PUT /projects/:id', id, { title, status });
    
    // Vérifier si le projet existe
    let existingProject;
    try {
      existingProject = await databases.getDocument(
        DB_ID,
        PROJECTS_COLLECTION,
        id
      );
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé'
        });
      }
      throw error;
    }
    
    // Vérifier les doublons si le titre change
    if (title && title !== existingProject.title) {
      try {
        const duplicateProjects = await databases.listDocuments(
          DB_ID,
          PROJECTS_COLLECTION,
          [
            Query.search('title', title.trim()),
            Query.notEqual('$id', id)
          ]
        );
        
        if (duplicateProjects.total > 0) {
          return res.status(409).json({
            success: false,
            message: 'Un autre projet avec ce titre existe déjà'
          });
        }
      } catch (error) {
        console.warn('⚠️ Recherche doublons échouée:', error.message);
      }
    }
    
    const updateData = {
      updatedAt: new Date().toISOString()
    };
    
    // Nettoyer et valider chaque champ
    if (title !== undefined) {
      updateData.title = title.trim().substring(0, 100);
    }
    if (description !== undefined) {
      updateData.description = description.trim().substring(0, 500);
    }
    if (members !== undefined) {
      if (Array.isArray(members)) {
        // Vérifier que les membres existent
        const memberPromises = members.map(memberId =>
          databases.getDocument(DB_ID, MEMBERS_COLLECTION, memberId)
            .then(() => memberId)
            .catch(() => null)
        );
        
        const validMembers = await Promise.all(memberPromises);
        updateData.members = validMembers.filter(memberId => memberId !== null);
      } else {
        updateData.members = [];
      }
    }
    if (status !== undefined) {
      updateData.status = ['idea', 'active', 'completed', 'archived'].includes(status) 
        ? status 
        : existingProject.status;
    }
    if (organization !== undefined) {
      updateData.organization = organization.trim().substring(0, 100);
    }
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        updateData.tags = tags.map(tag => tag.toString().trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      } else if (typeof tags === 'string') {
        updateData.tags = tags.split(',')
          .map(tag => tag.trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      } else {
        updateData.tags = [];
      }
    }
    
    console.log('🔄 Mise à jour projet:', updateData);
    
    const updatedProject = await databases.updateDocument(
      DB_ID,
      PROJECTS_COLLECTION,
      id,
      updateData
    );
    
    // 🔥 Populer les données des membres pour la réponse
    if (updatedProject.members && updatedProject.members.length > 0) {
      try {
        const memberPromises = updatedProject.members.map(memberId =>
          databases.getDocument(DB_ID, MEMBERS_COLLECTION, memberId)
            .catch(() => null)
        );
        
        const members = await Promise.all(memberPromises);
        updatedProject.membersData = members.filter(m => m !== null);
      } catch (error) {
        console.error('❌ Erreur population membres:', error);
        updatedProject.membersData = [];
      }
    } else {
      updatedProject.membersData = [];
    }
    
    res.json({
      success: true,
      message: 'Projet modifié avec succès',
      project: updatedProject
    });
    
  } catch (error) {
    console.error('❌ Erreur PUT /projects/:id:', error);
    handleAppWriteError(error, res);
  }
});

// 🔥 DELETE supprimer un projet
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ DELETE /projects/:id', id);
    
    // Vérifier si le projet existe
    try {
      await databases.getDocument(DB_ID, PROJECTS_COLLECTION, id);
    } catch (error) {
      if (error.code === 404) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé'
        });
      }
      throw error;
    }
    
    await databases.deleteDocument(DB_ID, PROJECTS_COLLECTION, id);
    
    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur DELETE /projects/:id:', error);
    handleAppWriteError(error, res);
  }
});

// 🔥 POST Importer les projets depuis les membres
router.post('/import-from-members', async (req, res) => {
  try {
    console.log('🔄 Importation des projets depuis les membres...');
    
    // Récupérer tous les membres
    const members = await databases.listDocuments(
      DB_ID,
      MEMBERS_COLLECTION,
      [
        Query.limit(1000) // Limiter pour éviter les timeouts
      ]
    );
    
    console.log(`📋 ${members.total} membres trouvés`);
    
    const projectsMap = new Map();
    let importedCount = 0;
    let errorCount = 0;
    
    // 🔥 Étape 1: Extraire les projets de chaque membre
    for (const member of members.documents) {
      if (member.projects) {
        let projectList = [];
        
        // Gérer différents formats de projets
        if (Array.isArray(member.projects)) {
          projectList = member.projects;
        } else if (typeof member.projects === 'string') {
          projectList = member.projects.split(/[,;|]/)
            .map(p => p.trim())
            .filter(p => p && p.length > 0);
        }
        
        for (const projectName of projectList) {
          const key = projectName.toLowerCase();
          
          if (!projectsMap.has(key)) {
            projectsMap.set(key, {
              title: projectName,
              description: `Projet importé depuis le profil de ${member.name || 'un membre'}`,
              organization: member.organization || member.entreprise || '',
              status: 'idea',
              tags: Array.isArray(member.specialties) ? member.specialties : 
                    (typeof member.specialties === 'string' ? member.specialties.split(',').map(s => s.trim()) : []),
              members: [member.$id],
              importedFromMember: true,
              memberSource: member.name || 'Membre',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } else {
            // Ajouter le membre au projet existant
            const existingProject = projectsMap.get(key);
            if (!existingProject.members.includes(member.$id)) {
              existingProject.members.push(member.$id);
            }
          }
        }
      }
    }
    
    const extractedProjects = Array.from(projectsMap.values());
    console.log(`📋 ${extractedProjects.length} projets extraits des membres`);
    
    // 🔥 Étape 2: Sauvegarder les nouveaux projets
    for (const projectData of extractedProjects) {
      try {
        // Vérifier si le projet existe déjà
        const existingProjects = await databases.listDocuments(
          DB_ID,
          PROJECTS_COLLECTION,
          [
            Query.search('title', projectData.title)
          ]
        );
        
        if (existingProjects.total === 0) {
          await databases.createDocument(
            DB_ID,
            PROJECTS_COLLECTION,
            ID.unique(),
            projectData
          );
          importedCount++;
          console.log(`✅ Projet importé: "${projectData.title}"`);
        } else {
          console.log(`⏭️ Projet existant: "${projectData.title}"`);
        }
      } catch (error) {
        console.error(`❌ Erreur import "${projectData.title}":`, error.message);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Importation terminée: ${importedCount} nouveaux projets, ${errorCount} erreurs`,
      imported: importedCount,
      errors: errorCount,
      totalExtracted: extractedProjects.length
    });
    
  } catch (error) {
    console.error('❌ Erreur import projets:', error);
    handleAppWriteError(error, res);
  }
});

// 🔥 GET Statistiques des projets
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = {};
    
    // Compter par statut
    const statuses = ['idea', 'active', 'completed', 'archived'];
    
    for (const status of statuses) {
      const response = await databases.listDocuments(
        DB_ID,
        PROJECTS_COLLECTION,
        [Query.equal('status', status)]
      );
      stats[status] = response.total;
    }
    
    // Total général
    const totalResponse = await databases.listDocuments(
      DB_ID,
      PROJECTS_COLLECTION
    );
    stats.total = totalResponse.total;
    
    // Projets importés
    const importedResponse = await databases.listDocuments(
      DB_ID,
      PROJECTS_COLLECTION,
      [Query.equal('importedFromMember', true)]
    );
    stats.imported = importedResponse.total;
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    handleAppWriteError(error, res);
  }
});

module.exports = router;
