// routes/members.js - VERSION CORRIGÉE
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Configuration AppWrite
const APPWRITE_CONFIG = {
  ENDPOINT: process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: process.env.APPWRITE_PROJECT_ID || '6917d4340008cda26023',
  FUNCTION_ID: process.env.APPWRITE_FUNCTION_ID || '6917e0420005d9ac19c9',
  API_KEY: process.env.APPWRITE_API_KEY
};

// 🔹 Middleware pour logger les requêtes
router.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl}`, req.query);
  next();
});

// ==========================
// ROUTES PRINCIPALES
// ==========================

// 🔹 GET tous les membres depuis AppWrite
router.get("/", async (req, res) => {
  try {
    console.log("🔍 Route /members - Récupération depuis AppWrite");
    
    const { 
      search, 
      page = 1, 
      limit = 50, 
      specialty, 
      location, 
      status 
    } = req.query;

    // Appel de la fonction AppWrite
    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Erreur AppWrite: " + (appwriteResponse.message || 'Unknown error'),
        appwriteError: appwriteResponse
      });
    }

    let allMembers = appwriteResponse.data?.members || [];
    
    console.log(`📊 ${allMembers.length} membres reçus d'AppWrite`);

    // 🔹 NORMALISATION COMPLÈTE DES DONNÉES
    const normalizedMembers = normalizeMemberData(allMembers);
    console.log(`🔄 ${normalizedMembers.length} membres normalisés`);

    // Si pas de données, mode démo
    if (normalizedMembers.length === 0) {
      console.log("🔄 Aucune donnée reçue, activation mode démonstration");
      normalizedMembers = getDemoData();
    }

    // 🔍 FILTRAGE LOCAL
    let filteredMembers = filterMembers(normalizedMembers, { search, specialty, location, status });

    // 📄 PAGINATION
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    res.json({ 
      success: true, 
      data: paginatedMembers,
      total: filteredMembers.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filteredMembers.length / parseInt(limit)),
      source: allMembers.length > 0 ? 'appwrite' : 'demo',
      filters: { search, specialty, location, status }
    });

  } catch (err) {
    console.error("❌ Erreur GET /members:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors du chargement des membres", 
      error: err.message,
      source: 'error'
    });
  }
});

// 🔹 GET un membre par ID
router.get("/:id", async (req, res) => {
  try {
    console.log("🔍 Récupération membre ID:", req.params.id);
    
    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Erreur AppWrite",
        appwriteError: appwriteResponse
      });
    }

    const allMembers = appwriteResponse.data?.members || [];
    
    // 🔹 NORMALISATION AVANT RECHERCHE
    const normalizedMembers = normalizeMemberData(allMembers);
    const member = normalizedMembers.find(m => m._id === req.params.id || m.id === req.params.id);

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé" 
      });
    }

    res.json({ 
      success: true, 
      data: member,
      source: 'appwrite'
    });

  } catch (err) {
    console.error("❌ Erreur GET /members/:id:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur", 
      error: err.message 
    });
  }
});

// 🔹 GET toutes les collections
router.get("/collections/all", async (req, res) => {
  try {
    console.log("🗂️ Récupération de toutes les collections");

    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Erreur AppWrite",
        appwriteError: appwriteResponse
      });
    }

    const allData = appwriteResponse.data || {};
    
    // 🔹 NORMALISATION DES MEMBRES DANS LES COLLECTIONS
    if (allData.members && Array.isArray(allData.members)) {
      allData.members = normalizeMemberData(allData.members);
    }

    // Statistiques
    const stats = {};
    Object.keys(allData).forEach(collection => {
      stats[collection] = Array.isArray(allData[collection]) ? allData[collection].length : 0;
    });

    console.log(`📈 Collections: ${Object.keys(allData).join(', ')}`);

    res.json({
      success: true,
      data: allData,
      collections: Object.keys(allData),
      statistics: stats,
      totalCollections: Object.keys(allData).length,
      source: 'appwrite'
    });

  } catch (err) {
    console.error("❌ Erreur GET /collections/all:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur collections", 
      error: err.message 
    });
  }
});

// ==========================
// FONCTIONS UTILITAIRES CORRIGÉES
// ==========================

// 🔹 FONCTION DE NORMALISATION CORRIGÉE
function normalizeMemberData(members) {
  if (!Array.isArray(members)) return [];

  return members.map(member => {
    console.log('🔍 Normalisation membre:', { 
      name: member.name, 
      specialties: member.specialties,
      skills: member.skills,
      types: {
        specialties: typeof member.specialties,
        skills: typeof member.skills
      }
    });

    // 🔹 CONVERSION DES SPÉCIALITÉS
    let specialties = [];
    if (Array.isArray(member.specialties)) {
      // Déjà un tableau - on nettoie
      specialties = member.specialties
        .map(spec => {
          if (typeof spec === 'string') return spec.trim();
          return String(spec).trim();
        })
        .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
    } else if (typeof member.specialties === 'string') {
      // String à convertir en tableau
      specialties = member.specialties
        .split(/[,;|]/) // Séparateurs: virgule, point-virgule, pipe
        .map(spec => spec.trim())
        .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
    }
    // Si undefined/null, reste tableau vide

    // 🔹 CONVERSION DES COMPÉTENCES
    let skills = [];
    if (Array.isArray(member.skills)) {
      skills = member.skills
        .map(skill => {
          if (typeof skill === 'string') return skill.trim();
          return String(skill).trim();
        })
        .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
    } else if (typeof member.skills === 'string') {
      skills = member.skills
        .split(/[,;|]/)
        .map(skill => skill.trim())
        .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
    }

    // 🔹 CORRECTION DU CHEMIN DE LA PHOTO
    let photoUrl = member.photo || '';
    if (photoUrl) {
      // Correction des chemins relatifs
      if (photoUrl.startsWith('../assets/photos/')) {
        photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
      }
      // Ajouter le domaine si chemin relatif
      if (photoUrl.startsWith('/') && !photoUrl.startsWith('//')) {
        photoUrl = `${process.env.BASE_URL || ''}${photoUrl}`;
      }
    }

    // 🔹 ORGANISATION/ENTREPRISE
    const organization = member.organization || member.entreprise || '';
    const entreprise = member.entreprise || member.organization || '';

    const normalizedMember = {
      // Identifiant
      _id: member._id || member.id || generateId(),
      
      // Informations personnelles
      name: member.name?.trim() || '',
      title: member.title?.trim() || '',
      email: member.email?.trim() || '',
      phone: member.phone?.trim() || '',
      location: member.location?.trim() || '',
      
      // 🔹 TABLEAUX CORRIGÉS
      specialties: specialties,
      skills: skills,
      
      // Organisation
      organization: organization,
      entreprise: entreprise,
      
      // Expérience et projets
      experienceYears: parseInt(member.experienceYears) || 0,
      projects: member.projects?.trim() || '',
      bio: member.bio?.trim() || member.projects?.trim() || '', // Fallback sur projects si pas de bio
      
      // Statut
      statutMembre: member.statutMembre || 'Actif',
      
      // Fichiers et liens
      photo: photoUrl,
      cvLink: member.cvLink || '',
      linkedin: member.linkedin || '',
      
      // Métadonnées
      isActive: member.isActive !== undefined ? member.isActive : true,
      availability: member.availability || ''
    };

    console.log('✅ Membre normalisé:', {
      name: normalizedMember.name,
      specialties: normalizedMember.specialties,
      skills: normalizedMember.skills,
      specialtiesCount: normalizedMember.specialties.length,
      skillsCount: normalizedMember.skills.length
    });

    return normalizedMember;
  });
}

// 🔹 FONCTION DE FILTRAGE CORRIGÉE
function filterMembers(members, filters) {
  let filtered = [...members];
  const { search, specialty, location, status } = filters;

  if (search && search.trim()) {
    const searchTerm = search.trim().toLowerCase();
    filtered = filtered.filter(member => {
      const searchText = `
        ${member.name || ''}
        ${member.title || ''}
        ${member.email || ''}
        ${member.specialties?.join(' ') || ''}
        ${member.skills?.join(' ') || ''}
        ${member.location || ''}
        ${member.organization || ''}
        ${member.entreprise || ''}
        ${member.projects || ''}
      `.toLowerCase();
      
      return searchText.includes(searchTerm);
    });
  }

  if (specialty && specialty.trim()) {
    const specialtyTerm = specialty.trim().toLowerCase();
    filtered = filtered.filter(member => {
      // Vérifie dans le tableau des spécialités
      return member.specialties?.some(spec => 
        spec && spec.toLowerCase().includes(specialtyTerm)
      );
    });
  }

  if (location && location.trim()) {
    const locationTerm = location.trim().toLowerCase();
    filtered = filtered.filter(member => 
      member.location && member.location.toLowerCase().includes(locationTerm)
    );
  }

  if (status && status.trim()) {
    const statusTerm = status.trim().toLowerCase();
    filtered = filtered.filter(member => 
      member.statutMembre && member.statutMembre.toLowerCase().includes(statusTerm)
    );
  }

  console.log(`🔍 Filtrage: ${members.length} → ${filtered.length} membres`);
  return filtered;
}

// 🔹 FONCTION APPWRITE (inchangée)
async function callAppWriteFunction() {
  try {
    console.log("🔄 Appel de la fonction AppWrite...");
    
    const appwriteUrl = `${APPWRITE_CONFIG.ENDPOINT}/functions/${APPWRITE_CONFIG.FUNCTION_ID}/executions`;
    
    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
      },
      timeout: 25000
    };

    if (APPWRITE_CONFIG.API_KEY) {
      requestConfig.headers['X-Appwrite-Key'] = APPWRITE_CONFIG.API_KEY;
    }

    const response = await axios.post(appwriteUrl, {}, requestConfig);

    console.log("✅ Réponse AppWrite - Status:", response.status);

    let responseBody;
    if (response.data.response) {
      responseBody = typeof response.data.response === 'string' 
        ? JSON.parse(response.data.response) 
        : response.data.response;
    } else {
      responseBody = response.data;
    }

    console.log("📦 Structure réponse:", {
      success: responseBody.success,
      dataKeys: responseBody.data ? Object.keys(responseBody.data) : 'no data',
      membersCount: responseBody.data?.members?.length || 0
    });

    return responseBody;

  } catch (err) {
    console.error("❌ Erreur appel AppWrite:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText
    });

    return {
      success: false,
      message: "Erreur de connexion à AppWrite",
      error: err.message,
      code: err.code,
      status: err.response?.status
    };
  }
}

// 🔹 GÉNÉRATEUR D'ID FALLBACK
function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

// 🔹 DONNÉES DE DÉMO CORRIGÉES
function getDemoData() {
  return normalizeMemberData([
    { 
      _id: '1', 
      name: 'Jean Dupont', 
      specialties: ['Énergie Solaire', 'Smart Grid'], 
      skills: ['Gestion de projet', 'Énergies renouvelables'], 
      location: 'Douala', 
      statutMembre: 'Actif',
      title: 'Ingénieur Senior en Énergie',
      email: 'jean.dupont@energie-cm.com',
      organization: 'Energy Solutions Cameroun',
      experienceYears: 8
    },
    { 
      _id: '2', 
      name: 'Marie Martin', 
      specialties: ['Environnement', 'Développement Durable'], 
      skills: ['Analyse technique', 'Audit environnemental'], 
      location: 'Yaoundé', 
      statutMembre: 'Actif',
      title: 'Consultante Environnement',
      email: 'marie.martin@eco-consult.com',
      organization: 'EcoConsult Cameroun',
      experienceYears: 5
    }
  ]);
}

// 🔹 CALCUL DES STATISTIQUES CORRIGÉ
function calculateStats(members) {
  const normalizedMembers = normalizeMemberData(members);
  const totalMembers = normalizedMembers.length;
  const activeMembers = normalizedMembers.filter(m => m.statutMembre === 'Actif').length;
  
  const locationStats = {};
  const specialtyStats = {};
  const orgStats = {};

  normalizedMembers.forEach(member => {
    // Localisations
    if (member.location) {
      locationStats[member.location] = (locationStats[member.location] || 0) + 1;
    }

    // Spécialités (tableau maintenant)
    if (member.specialties && Array.isArray(member.specialties)) {
      member.specialties.forEach(spec => {
        if (spec) {
          specialtyStats[spec] = (specialtyStats[spec] || 0) + 1;
        }
      });
    }

    // Organisations
    const org = member.organization || member.entreprise;
    if (org) {
      orgStats[org] = (orgStats[org] || 0) + 1;
    }
  });

  return {
    totalMembers,
    totalActive: activeMembers,
    totalInactive: totalMembers - activeMembers,
    locations: Object.entries(locationStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    specialties: Object.entries(specialtyStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    organizations: Object.entries(orgStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  };
}

// 🔹 EXTRACTION DES MÉTADONNÉES CORRIGÉE
function extractMetadata(members) {
  const normalizedMembers = normalizeMemberData(members);
  const specialties = new Set();
  const locations = new Set();
  const organizations = new Set();
  const statuses = new Set();

  normalizedMembers.forEach(member => {
    // Spécialités (tableau maintenant)
    if (member.specialties && Array.isArray(member.specialties)) {
      member.specialties.forEach(spec => spec && specialties.add(spec));
    }
    
    if (member.location) locations.add(member.location);
    
    const org = member.organization || member.entreprise;
    if (org) organizations.add(org);
    
    if (member.statutMembre) statuses.add(member.statutMembre);
  });

  return {
    specialties: Array.from(specialties).sort(),
    locations: Array.from(locations).sort(),
    organizations: Array.from(organizations).sort(),
    statuses: Array.from(statuses).sort()
  };
}

// Routes restantes inchangées...
router.get("/stats/summary", async (req, res) => {
  try {
    console.log("📊 Récupération des statistiques");

    const appwriteResponse = await callAppWriteFunction();
    
    let allMembers = [];
    let source = 'appwrite';

    if (appwriteResponse.success) {
      allMembers = appwriteResponse.data?.members || [];
    } else {
      allMembers = getDemoData();
      source = 'demo';
      console.log("🔄 Utilisation des données de démonstration pour les stats");
    }

    const stats = calculateStats(allMembers);

    res.json({
      success: true,
      stats: stats,
      source: source,
      totalMembers: allMembers.length
    });

  } catch (err) {
    console.error("❌ Erreur GET /stats/summary:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur statistiques", 
      error: err.message 
    });
  }
});

router.get("/metadata/filters", async (req, res) => {
  try {
    console.log("🎯 Récupération des métadonnées filtres");

    const appwriteResponse = await callAppWriteFunction();
    
    let allMembers = [];

    if (appwriteResponse.success) {
      allMembers = appwriteResponse.data?.members || [];
    } else {
      allMembers = getDemoData();
    }

    const metadata = extractMetadata(allMembers);

    res.json({
      success: true,
      metadata: metadata,
      totalMembers: allMembers.length
    });

  } catch (err) {
    console.error("❌ Erreur GET /metadata/filters:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur métadonnées", 
      error: err.message 
    });
  }
});

// Routes de debug et health check inchangées...
router.get("/debug/appwrite", async (req, res) => {
  try {
    console.log("🐛 Test connexion AppWrite");
    
    const result = await callAppWriteFunction();
    
    res.json({
      success: true,
      appwriteConfig: {
        endpoint: APPWRITE_CONFIG.ENDPOINT,
        projectId: APPWRITE_CONFIG.PROJECT_ID,
        functionId: APPWRITE_CONFIG.FUNCTION_ID,
        hasApiKey: !!APPWRITE_CONFIG.API_KEY
      },
      appwriteResponse: result,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("❌ Erreur test AppWrite:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur test AppWrite", 
      error: err.message 
    });
  }
});

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API Members opérationnelle",
    timestamp: new Date().toISOString(),
    appwrite: {
      endpoint: APPWRITE_CONFIG.ENDPOINT,
      projectId: APPWRITE_CONFIG.PROJECT_ID,
      functionId: APPWRITE_CONFIG.FUNCTION_ID
    }
  });
});

module.exports = router;
