// functions/get-matrice-complete/src/index.js - VERSION AVEC DEBUG
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice-complete");

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
    
    // 🔹 DÉBUG : Lister toutes les collections disponibles
    const collections = await db.listCollections().toArray();
    log("📋 Collections disponibles dans la base:", collections.map(c => c.name));
    
    // 🔹 Vérifier l'existence de chaque collection
    const collectionNames = ['members', 'projects', 'groups', 'analyses', 'skills', 'specialties', 'interactions'];
    
    for (const collectionName of collectionNames) {
      const collectionExists = collections.some(c => c.name === collectionName);
      if (collectionExists) {
        log(`✅ Collection trouvée: ${collectionName}`);
      } else {
        log(`❌ Collection NON trouvée: ${collectionName}`);
      }
    }

    // 🔹 Récupérer uniquement les collections qui existent
    const collectionPromises = [];
    
    for (const collectionName of collectionNames) {
      const collectionExists = collections.some(c => c.name === collectionName);
      if (collectionExists) {
        collectionPromises.push(
          db.collection(collectionName).find({}).toArray()
            .then(data => {
              log(`✅ ${collectionName}: ${data.length} documents`);
              return { name: collectionName, data };
            })
            .catch(err => {
              error(`❌ Erreur ${collectionName}: ${err.message}`);
              return { name: collectionName, data: [], error: err.message };
            })
        );
      } else {
        collectionPromises.push(Promise.resolve({ name: collectionName, data: [] }));
      }
    }

    const results = await Promise.all(collectionPromises);
    
    // 🔹 Organiser les résultats par nom de collection
    const collectionsData = {};
    results.forEach(result => {
      collectionsData[result.name] = result.data;
    });

    log("📊 Résultats récupération:", Object.keys(collectionsData).map(key => `${key}: ${collectionsData[key].length}`));

    // 🔹 Formater les données
    const formattedData = {
      members: formatMembers(collectionsData.members || []),
      projects: formatProjects(collectionsData.projects || []),
      groups: formatGroups(collectionsData.groups || []),
      analyses: formatAnalyses(collectionsData.analyses || []),
      skills: formatSkills(collectionsData.skills || []),
      specialties: formatSpecialties(collectionsData.specialties || []),
      interactions: formatInteractions(collectionsData.interactions || [])
    };

    await client.close();

    // 🔹 Retourner les données au format attendu
    return res.json({
      success: true,
      // Format principal pour le frontend
      projects: formattedData.projects,
      members: formattedData.members,
      
      // Toutes les données
      data: formattedData,
      
      // Métadonnées
      collections: collections.map(c => c.name),
      foundCollections: Object.keys(collectionsData).filter(key => collectionsData[key].length > 0),
      totals: {
        members: formattedData.members.length,
        projects: formattedData.projects.length,
        groups: formattedData.groups.length,
        analyses: formattedData.analyses.length,
        skills: formattedData.skills.length,
        specialties: formattedData.specialties.length,
        interactions: formattedData.interactions.length
      },
      message: `Données chargées - Projets: ${formattedData.projects.length}, Membres: ${formattedData.members.length}`
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      message: err.message,
      collections: collections ? collections.map(c => c.name) : [],
      error: err.stack
    });
  }
}

// 🔹 Fonctions de formatage
function formatMembers(members) {
  return members.map(member => ({
    _id: member._id?.toString(),
    name: member.name || '',
    title: member.title || '',
    email: member.email || '',
    phone: member.phone || '',
    specialties: Array.isArray(member.specialties) ? member.specialties : [],
    skills: Array.isArray(member.skills) ? member.skills : [],
    location: member.location || '',
    organization: member.organization || '',
    entreprise: member.entreprise || '',
    experienceYears: member.experienceYears || 0,
    projects: member.projects || '',
    availability: member.availability || '',
    statutMembre: member.statutMembre || 'Actif',
    photo: member.photo || '',
    cvLink: member.cvLink || '',
    linkedin: member.linkedin || '',
    isActive: member.isActive !== undefined ? member.isActive : true,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  }));
}

function formatProjects(projects) {
  return projects.map(project => ({
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
}

function formatGroups(groups) {
  return groups.map(group => ({
    _id: group._id?.toString(),
    name: group.name || '',
    description: group.description || '',
    type: group.type || 'technique',
    privacy: group.privacy || 'public',
    tags: Array.isArray(group.tags) ? group.tags : [],
    members: group.members ? group.members.map(m => m?.toString()) : [],
    leader: group.leader?.toString() || null,
    autoCreated: group.autoCreated || false,
    creationType: group.creationType || 'manual',
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }));
}

function formatAnalyses(analyses) {
  return analyses.map(analysis => ({
    _id: analysis._id?.toString(),
    type: analysis.type || 'interaction_analysis',
    title: analysis.title || '',
    description: analysis.description || '',
    insights: analysis.insights || {},
    suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
    dataSummary: analysis.dataSummary || {},
    statistics: analysis.statistics || {},
    status: analysis.status || 'completed',
    timestamp: analysis.timestamp || analysis.createdAt,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt
  }));
}

function formatSkills(skills) {
  return skills.map(skill => ({
    _id: skill._id?.toString(),
    name: skill.name || '',
    category: skill.category || 'technique',
    level: skill.level || 'intermédiaire',
    description: skill.description || '',
    memberCount: skill.memberCount || 0,
    popularity: skill.popularity || 0,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt
  }));
}

function formatSpecialties(specialties) {
  return specialties.map(specialty => ({
    _id: specialty._id?.toString(),
    name: specialty.name || '',
    category: specialty.category || 'technique',
    description: specialty.description || '',
    level: specialty.level || 'intermédiaire',
    memberCount: specialty.memberCount || 0,
    popularity: specialty.popularity || 0,
    createdAt: specialty.createdAt,
    updatedAt: specialty.updatedAt
  }));
}

function formatInteractions(interactions) {
  return interactions.map(interaction => ({
    _id: interaction._id?.toString(),
    type: interaction.type || 'message',
    title: interaction.title || '',
    description: interaction.description || '',
    from: interaction.from?.toString() || '',
    to: interaction.to ? interaction.to.map(t => t?.toString()) : [],
    projects: interaction.projects ? interaction.projects.map(p => p?.toString()) : [],
    groups: interaction.groups ? interaction.groups.map(g => g?.toString()) : [],
    specialties: Array.isArray(interaction.specialties) ? interaction.specialties.map(s => s?.toString()) : [],
    status: interaction.status || 'pending',
    category: interaction.category || 'manual',
    ai_analysis: interaction.ai_analysis || {},
    createdAt: interaction.createdAt,
    updatedAt: interaction.updatedAt,
    participantCount: 1 + (interaction.to ? interaction.to.length : 0)
  }));
}
