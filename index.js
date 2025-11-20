// functions/get-matrice/src/index.js - VERSION COMPLÈTEMENT CORRIGÉE
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - VERSION CORRIGÉE");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    const msg = "❌ Variable MONGODB_URI manquante !";
    error(msg);
    return res.json({ 
      success: false, 
      message: msg
    });
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    
    // 🔥 CORRECTION : Vérification des collections existantes
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    log(`📋 Collections disponibles: ${collectionNames.join(', ')}`);

    // 🔥 CORRECTION : Récupération avec gestion d'erreur améliorée
    const collectionData = {};
    const errors = [];

    // Fonction pour récupérer une collection avec gestion d'erreur
    const fetchCollection = async (collectionName, options = {}) => {
      try {
        if (!collectionNames.includes(collectionName)) {
          log(`⚠️ Collection ${collectionName} non trouvée, retour tableau vide`);
          return [];
        }
        
        const collection = db.collection(collectionName);
        let query = collection.find(options.filter || {});
        
        if (options.sort) query = query.sort(options.sort);
        if (options.limit) query = query.limit(options.limit);
        
        const result = await query.toArray();
        log(`✅ ${collectionName}: ${result.length} documents`);
        return result;
      } catch (err) {
        error(`❌ Erreur collection ${collectionName}: ${err.message}`);
        errors.push({ collection: collectionName, error: err.message });
        return [];
      }
    };

    // 🔥 Récupération parallèle de toutes les collections
    const [
      members,
      projects,
      groups,
      analyses,
      skills,
      specialties,
      interactions
    ] = await Promise.all([
      fetchCollection('members'),
      fetchCollection('projects', { sort: { createdAt: -1 } }),
      fetchCollection('groups'),
      fetchCollection('analyses', { sort: { createdAt: -1 } }),
      fetchCollection('skills'),
      fetchCollection('specialties'),
      fetchCollection('interactions', { sort: { createdAt: -1 } })
    ]);

    log(`📊 DONNÉES RÉCUPÉRÉES: ${members.length} membres, ${projects.length} projets, ${groups.length} groupes, ${analyses.length} analyses, ${skills.length} compétences, ${specialties.length} spécialités, ${interactions.length} interactions`);

    // 🔥 FONCTION UNIVERSELLE DE NETTOYAGE DES TABLEAUX
    const cleanArray = (data, fieldName = '') => {
      if (!data) return [];
      
      if (Array.isArray(data)) {
        return data
          .map(item => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object' && item.name) return item.name.trim();
            return String(item).trim();
          })
          .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
      }
      
      if (typeof data === 'string') {
        return data
          .split(/[,;|]/)
          .map(item => item.trim())
          .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
      }
      
      return [String(data).trim()].filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
    };

    // 🔥 CORRECTION OPTIMISÉE DES MEMBRES
    const formattedMembers = members.map(member => {
      // Nettoyage des spécialités et compétences
      const memberSpecialties = cleanArray(member.specialties, 'specialties');
      const memberSkills = cleanArray(member.skills, 'skills');

      // Correction des URLs de photos
      let photoUrl = member.photo || '';
      if (photoUrl && photoUrl.startsWith('../assets/photos/')) {
        photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
      }

      // Structure finale du membre
      return {
        _id: member._id?.toString(),
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        phone: member.phone || '',
        
        // Champs corrigés
        specialties: memberSpecialties,
        skills: memberSkills,
        
        location: member.location || '',
        organization: member.organization || '',
        entreprise: member.entreprise || '',
        experienceYears: member.experienceYears || 0,
        projects: member.projects || '',
        availability: member.availability || '',
        statutMembre: member.statutMembre || 'Actif',
        photo: photoUrl,
        cvLink: member.cvLink || '',
        linkedin: member.linkedin || '',
        isActive: member.isActive !== undefined ? member.isActive : true,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      };
    });

    // 🔥 STATISTIQUES DÉTAILLÉES
    const stats = {
      membersWithSpecialties: formattedMembers.filter(m => m.specialties.length > 0).length,
      membersWithSkills: formattedMembers.filter(m => m.skills.length > 0).length,
      membersWithBoth: formattedMembers.filter(m => m.specialties.length > 0 && m.skills.length > 0).length,
      totalSpecialties: [...new Set(formattedMembers.flatMap(m => m.specialties))].length,
      totalSkills: [...new Set(formattedMembers.flatMap(m => m.skills))].length
    };

    log("🎯 STATISTIQUES FINALES:", stats);

    // 🔥 Formater les autres collections
    const formatCollection = (collection, mapper) => 
      collection.map(mapper).filter(item => item !== null);

    const formattedProjects = formatCollection(projects, project => ({
      _id: project._id?.toString(),
      title: project.title || 'Sans titre',
      description: project.description || '',
      members: project.members ? project.members.map(m => m?.toString()) : [],
      status: project.status || 'idea',
      organization: project.organization || '',
      tags: Array.isArray(project.tags) ? project.tags : [],
      createdAt: project.createdAt || new Date(),
      importedFromMember: project.importedFromMember || false,
      memberSource: project.memberSource || ''
    }));

    const formattedGroups = formatCollection(groups, group => ({
      _id: group._id?.toString(),
      name: group.name || '',
      description: group.description || '',
      type: group.type || 'technique',
      privacy: group.privacy || 'public',
      tags: Array.isArray(group.tags) ? group.tags : [],
      members: group.members ? group.members.map(m => m?.toString()) : [],
      leader: group.leader?.toString() || null,
      memberCount: group.members ? group.members.length : 0
    }));

    const formattedAnalyses = formatCollection(analyses, analysis => ({
      _id: analysis._id?.toString(),
      type: analysis.type || 'interaction_analysis',
      title: analysis.title || '',
      description: analysis.description || '',
      insights: analysis.insights || {},
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
      statistics: analysis.statistics || {},
      status: analysis.status || 'completed',
      analysisTimestamp: analysis.analysisTimestamp || analysis.createdAt
    }));

    const formattedSkills = formatCollection(skills, skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || 'technique',
      description: skill.description || '',
      memberCount: skill.memberCount || 0
    }));

    const formattedSpecialties = formatCollection(specialties, specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || 'technique',
      description: specialty.description || '',
      memberCount: specialty.memberCount || 0
    }));

    const formattedInteractions = formatCollection(interactions, interaction => ({
      _id: interaction._id?.toString(),
      type: interaction.type || 'message',
      title: interaction.title || '',
      description: interaction.description || '',
      from: interaction.from?.toString() || '',
      to: interaction.to ? interaction.to.map(t => t?.toString()) : [],
      projects: interaction.projects ? interaction.projects.map(p => p?.toString()) : [],
      status: interaction.status || 'pending',
      participantCount: 1 + (interaction.to ? interaction.to.length : 0)
    }));

    await client.close();

    // 🔥 RÉPONSE FINALE OPTIMISÉE
    const responseData = {
      success: true,
      
      // Format principal pour compatibilité
      projects: formattedProjects,
      members: formattedMembers,
      
      // Structure complète
      data: {
        members: formattedMembers,
        projects: formattedProjects,
        groups: formattedGroups,
        analyses: formattedAnalyses,
        skills: formattedSkills,
        specialties: formattedSpecialties,
        interactions: formattedInteractions
      },
      
      // Métadonnées enrichies
      metadata: {
        totals: {
          members: formattedMembers.length,
          projects: formattedProjects.length,
          groups: formattedGroups.length,
          analyses: formattedAnalyses.length,
          skills: formattedSkills.length,
          specialties: formattedSpecialties.length,
          interactions: formattedInteractions.length
        },
        skillsStats: stats,
        collectionErrors: errors.length,
        timestamp: new Date().toISOString(),
        database: DB_NAME,
        collections: collectionNames
      },
      
      message: `Données chargées: ${formattedMembers.length} membres (${stats.membersWithSpecialties} avec spécialités, ${stats.membersWithSkills} avec compétences)`
    };

    // 🔥 Ajouter les échantillons debug seulement si demandé
    if (process.env.NODE_ENV === 'development' || req.query.debug === 'true') {
      responseData.debug = {
        membersSample: formattedMembers.slice(0, 2).map(m => ({
          name: m.name,
          specialties: m.specialties,
          skills: m.skills
        })),
        skillsSample: formattedSkills.slice(0, 3),
        specialtiesSample: formattedSpecialties.slice(0, 3),
        errors: errors
      };
    }

    return res.json(responseData);

  } catch (err) {
    error("❌ Erreur critique: " + err.message);
    if (client) await client.close();
    
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des données",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Contactez l\'administrateur',
      timestamp: new Date().toISOString()
    });
  }
}
