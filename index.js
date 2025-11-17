// functions/get-matrice/src/index.js - VERSION CORRIGÉE POUR SPÉCIALITÉS/COMPÉTENCES
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
    
    // 🔹 Récupérer TOUTES les collections SANS LIMITES
    log("📥 Récupération de toutes les collections...");
    
    const [
      members,
      projects,
      groups,
      analyses,
      skills,
      specialties,
      interactions
    ] = await Promise.all([
      // Membres - TOUS avec champs complets
      db.collection('members').find({}).toArray(),
      
      // Projets - TOUS, triés par date
      db.collection('projects').find({}).sort({ createdAt: -1 }).toArray(),
      
      // Groupes - TOUS
      db.collection('groups').find({}).toArray(),
      
      // Analyses - TOUS, triées par date
      db.collection('analyses').find({}).sort({ createdAt: -1 }).toArray(),
      
      // Compétences - TOUTES
      db.collection('skills').find({}).toArray(),
      
      // Spécialités - TOUTES
      db.collection('specialties').find({}).toArray(),
      
      // Interactions - TOUTES, triées par date
      db.collection('interactions').find({}).sort({ createdAt: -1 }).toArray()
    ]);

    log(`📊 DONNÉES COMPLÈTES: ${members.length} membres, ${projects.length} projets, ${groups.length} groupes, ${analyses.length} analyses, ${skills.length} compétences, ${specialties.length} spécialités, ${interactions.length} interactions`);

    // 🔹 DEBUG: Analyser les premiers membres pour vérifier les données
    if (members.length > 0) {
      log("🔍 ANALYSE DES DONNÉES MEMBRES:");
      members.slice(0, 3).forEach((member, index) => {
        log(`Membre ${index + 1} - ${member.name}:`, {
          specialties: member.specialties,
          skills: member.skills,
          typeSpecialties: typeof member.specialties,
          typeSkills: typeof member.skills,
          specialtiesLength: member.specialties ? member.specialties.length : 0,
          skillsLength: member.skills ? member.skills.length : 0
        });
      });
    }

    // 🔹 CORRECTION CRITIQUE: Formater les membres avec gestion des spécialités/compétences
    const formattedMembers = members.map(member => {
      log(`🔄 Formatage membre: ${member.name}`);
      
      // 🔹 CORRECTION DES SPÉCIALITÉS
      let memberSpecialties = [];
      if (Array.isArray(member.specialties)) {
        // Cas normal: déjà un tableau
        memberSpecialties = member.specialties
          .map(spec => {
            if (typeof spec === 'string') {
              return spec.trim();
            }
            return String(spec).trim();
          })
          .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
        
        log(`✅ ${member.name} - Spécialités tableau: ${memberSpecialties.length} items`);
      } else if (typeof member.specialties === 'string') {
        // Cas string: conversion en tableau
        memberSpecialties = member.specialties
          .split(/[,;|]/)
          .map(spec => spec.trim())
          .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
        
        log(`🔄 ${member.name} - Spécialités string convertie: ${memberSpecialties.length} items`);
      } else if (member.specialties) {
        // Autre type (ObjectId, etc.)
        memberSpecialties = [String(member.specialties).trim()];
        log(`⚠️ ${member.name} - Spécialités autre type: ${memberSpecialties.length} items`);
      }

      // 🔹 CORRECTION DES COMPÉTENCES
      let memberSkills = [];
      if (Array.isArray(member.skills)) {
        memberSkills = member.skills
          .map(skill => {
            if (typeof skill === 'string') {
              return skill.trim();
            }
            return String(skill).trim();
          })
          .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
        
        log(`✅ ${member.name} - Compétences tableau: ${memberSkills.length} items`);
      } else if (typeof member.skills === 'string') {
        memberSkills = member.skills
          .split(/[,;|]/)
          .map(skill => skill.trim())
          .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
        
        log(`🔄 ${member.name} - Compétences string convertie: ${memberSkills.length} items`);
      } else if (member.skills) {
        memberSkills = [String(member.skills).trim()];
        log(`⚠️ ${member.name} - Compétences autre type: ${memberSkills.length} items`);
      }

      // 🔹 CORRECTION DES CHEMINS DE PHOTOS
      let photoUrl = member.photo || '';
      if (photoUrl && photoUrl.startsWith('../assets/photos/')) {
        photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
        log(`🖼️ ${member.name} - Photo corrigée: ${photoUrl}`);
      }

      const formattedMember = {
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

      // 🔹 LOG FINAL POUR VÉRIFICATION
      log(`✅ ${member.name} formaté:`, {
        specialtiesCount: formattedMember.specialties.length,
        skillsCount: formattedMember.skills.length,
        hasSpecialties: formattedMember.specialties.length > 0,
        hasSkills: formattedMember.skills.length > 0
      });

      return formattedMember;
    });

    // 🔹 VÉRIFICATION FINALE DES DONNÉES
    const membersWithSpecialties = formattedMembers.filter(m => m.specialties.length > 0).length;
    const membersWithSkills = formattedMembers.filter(m => m.skills.length > 0).length;
    
    log("🎯 VÉRIFICATION FINALE:");
    log(`- Membres avec spécialités: ${membersWithSpecialties}/${formattedMembers.length}`);
    log(`- Membres avec compétences: ${membersWithSkills}/${formattedMembers.length}`);
    
    // Afficher les détails des 3 premiers membres formatés
    formattedMembers.slice(0, 3).forEach((member, index) => {
      log(`📋 Membre ${index + 1} final: ${member.name}`, {
        specialties: member.specialties,
        skills: member.skills
      });
    });

    // 🔹 Formater les autres collections (inchangé)
    const formattedProjects = projects.map(project => ({
      _id: project._id?.toString(),
      title: project.title || 'Sans titre',
      description: project.description || '',
      members: project.members ? project.members.map(m => m?.toString()) : [],
      status: project.status || 'idea',
      organization: project.organization || '',
      tags: Array.isArray(project.tags) ? project.tags : [],
      createdAt: project.createdAt || new Date(),
      importedFromMember: project.importedFromMember || false,
      memberSource: project.memberSource || '',
      __v: project.__v || 0
    }));

    const formattedGroups = groups.map(group => ({
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
      updatedAt: group.updatedAt,
      __v: group.__v || 0
    }));

    const formattedAnalyses = analyses.map(analysis => ({
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
      updatedAt: analysis.updatedAt,
      __v: analysis.__v || 0
    }));

    const formattedSkills = skills.map(skill => ({
      _id: skill._id?.toString(),
      name: skill.name || '',
      category: skill.category || 'technique',
      level: skill.level || 'intermédiaire',
      description: skill.description || '',
      memberCount: skill.memberCount || 0,
      popularity: skill.popularity || 0,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
      __v: skill.__v || 0
    }));

    const formattedSpecialties = specialties.map(specialty => ({
      _id: specialty._id?.toString(),
      name: specialty.name || '',
      category: specialty.category || 'technique',
      description: specialty.description || '',
      level: specialty.level || 'intermédiaire',
      memberCount: specialty.memberCount || 0,
      popularity: specialty.popularity || 0,
      createdAt: specialty.createdAt,
      updatedAt: specialty.updatedAt,
      __v: specialty.__v || 0
    }));

    const formattedInteractions = interactions.map(interaction => ({
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
      __v: interaction.__v || 0,
      participantCount: 1 + (interaction.to ? interaction.to.length : 0)
    }));

    await client.close();

    log(`✅ FORMATAGE TERMINÉ: ${formattedProjects.length} projets, ${formattedMembers.length} membres formatés`);

    // 🔹 IMPORTANT: Retourner TOUTES les données avec format corrigé
    return res.json({
      success: true,
      // Format principal pour le frontend
      projects: formattedProjects,
      members: formattedMembers,
      
      // Toutes les données structurées
      data: {
        members: formattedMembers,
        projects: formattedProjects,
        groups: formattedGroups,
        analyses: formattedAnalyses,
        skills: formattedSkills,
        specialties: formattedSpecialties,
        interactions: formattedInteractions
      },
      
      // Statistiques complètes avec vérification spécialités/compétences
      totals: {
        members: formattedMembers.length,
        projects: formattedProjects.length,
        groups: formattedGroups.length,
        analyses: formattedAnalyses.length,
        skills: formattedSkills.length,
        specialties: formattedSpecialties.length,
        interactions: formattedInteractions.length,
        membersWithSpecialties: membersWithSpecialties,
        membersWithSkills: membersWithSkills
      },
      
      // Métadonnées de debug
      debug: {
        membersSample: formattedMembers.slice(0, 2).map(m => ({
          name: m.name,
          specialtiesCount: m.specialties.length,
          skillsCount: m.skills.length,
          specialties: m.specialties,
          skills: m.skills
        }))
      },
      
      // Métadonnées
      lastUpdated: new Date().toISOString(),
      database: DB_NAME,
      message: `Données chargées avec succès: ${formattedMembers.length} membres (${membersWithSpecialties} avec spécialités, ${membersWithSkills} avec compétences)`
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      message: err.message,
      error: err.stack
    });
  }
}
