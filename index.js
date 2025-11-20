// functions/get-matrice/src/index.js - VERSION COMPLÈTE AVEC SAUVEGARDE
import { MongoClient, ObjectId } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - VERSION COMPLÈTE");

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
    
    // 🔹 GESTION DES DIFFÉRENTES MÉTHODES HTTP
    const { method, path } = req;

    log(`📡 Méthode: ${method}, Chemin: ${path}`);

    // 🔹 ROUTE GET - Récupération de toutes les données
    if (method === 'GET' && path === '/api/v1/all-data/matrix-data') {
      log("📥 Récupération de toutes les collections...");
      
      const collectionPromises = {
        members: db.collection('members').find({}).toArray(),
        projects: db.collection('projects').find({}).sort({ createdAt: -1 }).toArray(),
        groups: db.collection('groups').find({}).toArray(),
        analyses: db.collection('analyses').find({}).sort({ createdAt: -1 }).toArray(),
        skills: db.collection('skills').find({}).toArray(),
        specialties: db.collection('specialties').find({}).toArray(),
        interactions: db.collection('interactions').find({}).sort({ createdAt: -1 }).toArray()
      };

      // 🔹 Exécution avec gestion d'erreur par collection
      const results = await Promise.allSettled(Object.values(collectionPromises));
      
      const [
        membersResult,
        projectsResult,
        groupsResult,
        analysesResult,
        skillsResult,
        specialtiesResult,
        interactionsResult
      ] = results;

      // 🔹 Extraction des données avec fallback
      const members = membersResult.status === 'fulfilled' ? membersResult.value : [];
      const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
      const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
      const analyses = analysesResult.status === 'fulfilled' ? analysesResult.value : [];
      const skills = skillsResult.status === 'fulfilled' ? skillsResult.value : [];
      const specialties = specialtiesResult.status === 'fulfilled' ? specialtiesResult.value : [];
      const interactions = interactionsResult.status === 'fulfilled' ? interactionsResult.value : [];

      // 🔹 Log des erreurs individuelles
      const errors = results.filter(result => result.status === 'rejected');
      if (errors.length > 0) {
        errors.forEach((err, index) => {
          error(`❌ Erreur collection ${index}: ${err.reason.message}`);
        });
      }

      log(`📊 DONNÉES RÉCUPÉRÉES: ${members.length} membres, ${projects.length} projets, ${groups.length} groupes, ${analyses.length} analyses, ${skills.length} compétences, ${specialties.length} spécialités, ${interactions.length} interactions`);

      // 🔹 FONCTION UNIVERSELLE DE NETTOYAGE DES TABLEAUX
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

      // 🔹 CORRECTION OPTIMISÉE DES MEMBRES
      const formattedMembers = members.map(member => {
        // 🔹 Nettoyage des spécialités et compétences
        const memberSpecialties = cleanArray(member.specialties, 'specialties');
        const memberSkills = cleanArray(member.skills, 'skills');

        // 🔹 Correction des URLs de photos
        let photoUrl = member.photo || '';
        if (photoUrl && photoUrl.startsWith('../assets/photos/')) {
          photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
        }

        // 🔹 Structure finale du membre
        return {
          _id: member._id?.toString(),
          name: member.name || '',
          title: member.title || '',
          email: member.email || '',
          phone: member.phone || '',
          
          // 🔹 CHAMPS CORRIGÉS
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

      // 🔹 STATISTIQUES DÉTAILLÉES
      const stats = {
        membersWithSpecialties: formattedMembers.filter(m => m.specialties.length > 0).length,
        membersWithSkills: formattedMembers.filter(m => m.skills.length > 0).length,
        membersWithBoth: formattedMembers.filter(m => m.specialties.length > 0 && m.skills.length > 0).length,
        totalSpecialties: [...new Set(formattedMembers.flatMap(m => m.specialties))].length,
        totalSkills: [...new Set(formattedMembers.flatMap(m => m.skills))].length
      };

      log("🎯 STATISTIQUES FINALES:", stats);

      // 🔹 Formater les autres collections
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

      // 🔹 RÉPONSE FINALE OPTIMISÉE
      return res.json({
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
          database: DB_NAME
        },
        
        message: `Données chargées: ${formattedMembers.length} membres (${stats.membersWithSpecialties} avec spécialités, ${stats.membersWithSkills} avec compétences)`
      });
    }

    // 🔹 ROUTE POST - Sauvegarde des analyses de synergies
    else if (method === 'POST' && path === '/api/v1/synergy-analysis') {
      log('💾 Route de sauvegarde analyse appelée...');
      
      let analysisData;
      try {
        // Parser le body de la requête
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        analysisData = body;
        
        log('📦 Données reçues:', {
          type: analysisData.type,
          title: analysisData.title,
          timestamp: analysisData.timestamp
        });
      } catch (parseError) {
        error('❌ Erreur parsing body:', parseError);
        return res.json({
          success: false,
          error: 'Format de données invalide'
        });
      }

      // Validation des données
      if (!analysisData || !analysisData.type) {
        return res.json({
          success: false,
          error: 'Données d\'analyse invalides: type manquant'
        });
      }

      try {
        const analysesCollection = db.collection('analyses');

        // 🔹 Vérifier si la collection existe, sinon la créer
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('analyses')) {
          await db.createCollection('analyses');
          log('✅ Collection "analyses" créée');
        }

        // 🔹 Préparer le document à sauvegarder
        const analysisDocument = {
          ...analysisData,
          createdAt: new Date(),
          updatedAt: new Date(),
          appwriteSaved: true,
          version: '1.0'
        };

        // 🔹 Sauvegarder dans MongoDB
        const result = await analysesCollection.insertOne(analysisDocument);
        
        log(`✅ Analyse sauvegardée avec ID: ${result.insertedId}`);
        
        return res.json({
          success: true,
          data: {
            id: result.insertedId,
            message: 'Analyse sauvegardée avec succès',
            timestamp: new Date().toISOString(),
            collection: 'analyses'
          }
        });

      } catch (dbError) {
        error('❌ Erreur base de données:', dbError);
        return res.json({
          success: false,
          error: `Erreur sauvegarde: ${dbError.message}`
        });
      }
    }

    // 🔹 ROUTE NON TROUVÉE
    else {
      return res.json({
        success: false,
        error: `Route non trouvée: ${method} ${path}`,
        availableRoutes: [
          'GET /api/v1/all-data/matrix-data',
          'POST /api/v1/synergy-analysis'
        ]
      });
    }

  } catch (err) {
    error("❌ Erreur critique: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      message: "Erreur lors du chargement des données",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Contactez l\'administrateur'
    });
  } finally {
    if (client) {
      await client.close();
      log('🔌 Connexion MongoDB fermée');
    }
  }
}
