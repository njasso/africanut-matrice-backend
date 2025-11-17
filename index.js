// functions/get-matrice/src/index.js - VERSION COMPLÈTE
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice");

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
    
    // 🔹 Récupérer TOUTES les collections en parallèle pour plus de performance
    const [
      members,
      projects,
      groups,
      analyses,
      skills,
      specialties,
      interactions
    ] = await Promise.all([
      // Membres
      db.collection('members').find({}).toArray(),
      
      // Projets avec population des membres
      db.collection('projects').find({}).toArray(),
      
      // Groupes
      db.collection('groups').find({}).toArray(),
      
      // Analyses
      db.collection('analyses').find({}).sort({ createdAt: -1 }).limit(10).toArray(),
      
      // Compétences
      db.collection('skills').find({}).toArray(),
      
      // Spécialités
      db.collection('specialties').find({}).toArray(),
      
      // Interactions
      db.collection('interactions').find({}).sort({ createdAt: -1 }).limit(20).toArray()
    ]);

    log(`📊 Données récupérées: ${members.length} membres, ${projects.length} projets, ${groups.length} groupes`);

    // 🔹 Formater les données pour le frontend
    const formattedMembers = members.map(member => ({
      _id: member._id?.toString(),
      name: member.name || '',
      email: member.email || '',
      title: member.title || '',
      organization: member.organization || '',
      entreprise: member.entreprise || '',
      specialties: member.specialties || [],
      skills: member.skills || [],
      projects: member.projects || '',
      groups: member.groups || [],
      location: member.location || '',
      phone: member.phone || '',
      status: member.status || 'active',
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
    }));

    const formattedProjects = projects.map(project => ({
      _id: project._id?.toString(),
      title: project.title || 'Sans titre',
      description: project.description || '',
      organization: project.organization || '',
      status: project.status || 'idea',
      tags: project.tags || [],
      members: project.members ? project.members.map(m => m?.toString()) : [],
      groups: project.groups ? project.groups.map(g => g?.toString()) : [],
      importedFromMember: project.importedFromMember || false,
      memberSource: project.memberSource || '',
      createdAt: project.createdAt || new Date(),
      updatedAt: project.updatedAt || new Date()
    }));

    const formattedGroups = groups.map(group => ({
      _id: group._id?.toString(),
      name: group.name || '',
      description: group.description || '',
      type: group.type || 'technique',
      privacy: group.privacy || 'public',
      members: group.members ? group.members.map(m => m?.toString()) : [],
      leader: group.leader?.toString() || null,
      autoCreated: group.autoCreated || false,
      creationType: group.creationType || 'manual',
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    const formattedAnalyses = analyses.map(analysis => ({
      _id: analysis._id?.toString(),
      type: analysis.type || '',
      title: analysis.title || '',
      description: analysis.description || '',
      insights: analysis.insights || {},
      suggestions: analysis.suggestions || [],
      dataSummary: analysis.dataSummary || {},
      statistics: analysis.statistics || {},
      status: analysis.status || 'completed',
      timestamp: analysis.timestamp,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    }));

    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || '',
      level: skill.level || '',
      description: skill.description || '',
      memberCount: skill.memberCount || 0,
      popularity: skill.popularity || 0,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt
    }));

    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || '',
      description: specialty.description || '',
      level: specialty.level || '',
      memberCount: specialty.memberCount || 0,
      popularity: specialty.popularity || 0,
      createdAt: specialty.createdAt,
      updatedAt: specialty.updatedAt
    }));

    const formattedInteractions = interactions.map(interaction => ({
      _id: interaction._id?.toString(),
      type: interaction.type || '',
      title: interaction.title || '',
      description: interaction.description || '',
      from: interaction.from?.toString() || '',
      to: interaction.to ? interaction.to.map(t => t?.toString()) : [],
      projects: interaction.projects ? interaction.projects.map(p => p?.toString()) : [],
      groups: interaction.groups ? interaction.groups.map(g => g?.toString()) : [],
      specialties: interaction.specialties || [],
      status: interaction.status || 'suggested',
      category: interaction.category || '',
      ai_analysis: interaction.ai_analysis || {},
      createdAt: interaction.createdAt,
      updatedAt: interaction.updatedAt
    }));

    await client.close();

    log(`✅ Données formatées: ${formattedProjects.length} projets, ${formattedMembers.length} membres`);

    // 🔹 IMPORTANT: Retourner le format EXACT attendu par le frontend
    return res.json({
      success: true,
      projects: formattedProjects,  // Direct à la racine pour le frontend
      members: formattedMembers,    // Direct à la racine pour le frontend
      data: {                       // Version structurée pour d'autres usages
        members: formattedMembers,
        projects: formattedProjects,
        groups: formattedGroups,
        analyses: formattedAnalyses,
        skills: formattedSkills,
        specialties: formattedSpecialties,
        interactions: formattedInteractions
      },
      totals: {
        members: formattedMembers.length,
        projects: formattedProjects.length,
        groups: formattedGroups.length,
        skills: formattedSkills.length,
        specialties: formattedSpecialties.length
      },
      message: `Données chargées avec succès: ${formattedProjects.length} projets, ${formattedMembers.length} membres`
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      message: err.message
    });
  }
}
