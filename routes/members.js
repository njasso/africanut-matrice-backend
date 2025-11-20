// routes/members.js - VERSION COMPLÈTEMENT CORRIGÉE
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
// ROUTES PRINCIPALES CORRIGÉES
// ==========================

// 🔹 GET tous les membres depuis AppWrite - VERSION CORRIGÉE
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

    // 🔥 CORRECTION : Appel AppWrite avec payload correct
    const appwriteResponse = await callAppWriteFunction({
      path: '/api/v1/all-data/matrix-data',
      method: 'GET'
    });
    
    console.log("📦 Réponse AppWrite brute:", {
      success: appwriteResponse.success,
      hasData: !!appwriteResponse.data,
      dataKeys: appwriteResponse.data ? Object.keys(appwriteResponse.data) : 'no-data'
    });

    let allMembers = [];
    let source = 'appwrite';

    if (appwriteResponse.success && appwriteResponse.data) {
      allMembers = appwriteResponse.data.members || [];
      console.log(`✅ ${allMembers.length} membres reçus d'AppWrite`);
    } else {
      console.log("❌ Erreur AppWrite, utilisation mode démo");
      allMembers = getDemoData();
      source = 'demo';
    }

    // 🔹 NORMALISATION COMPLÈTE DES DONNÉES
    const normalizedMembers = normalizeMemberData(allMembers);
    console.log(`🔄 ${normalizedMembers.length} membres normalisés`);

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
      source: source,
      filters: { search, specialty, location, status },
      metadata: {
        normalizedCount: normalizedMembers.length,
        filteredCount: filteredMembers.length
      }
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

// 🔹 GET un membre par ID - VERSION CORRIGÉE
router.get("/:id", async (req, res) => {
  try {
    console.log("🔍 Récupération membre ID:", req.params.id);
    
    const appwriteResponse = await callAppWriteFunction({
      path: '/api/v1/all-data/matrix-data',
      method: 'GET'
    });
    
    let allMembers = [];
    let source = 'appwrite';

    if (appwriteResponse.success && appwriteResponse.data) {
      allMembers = appwriteResponse.data.members || [];
    } else {
      allMembers = getDemoData();
      source = 'demo';
    }

    // 🔹 NORMALISATION AVANT RECHERCHE
    const normalizedMembers = normalizeMemberData(allMembers);
    const member = normalizedMembers.find(m => 
      m._id === req.params.id || 
      m.id === req.params.id ||
      (m._id && m._id.toString() === req.params.id)
    );

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé",
        searchedId: req.params.id,
        availableIds: normalizedMembers.slice(0, 5).map(m => m._id)
      });
    }

    res.json({ 
      success: true, 
      data: member,
      source: source
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

// 🔹 GET toutes les collections - VERSION CORRIGÉE
router.get("/collections/all", async (req, res) => {
  try {
    console.log("🗂️ Récupération de toutes les collections");

    const appwriteResponse = await callAppWriteFunction({
      path: '/api/v1/all-data/matrix-data',
      method: 'GET'
    });
    
    let allData = {};
    let source = 'appwrite';

    if (appwriteResponse.success && appwriteResponse.data) {
      allData = appwriteResponse.data;
    } else {
      // Données de démonstration complètes
      allData = {
        members: getDemoData(),
        projects: getDemoProjects(),
        groups: getDemoGroups(),
        analyses: [],
        interactions: [],
        skills: [],
        specialties: []
      };
      source = 'demo';
    }
    
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
      source: source,
      timestamp: new Date().toISOString()
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
// FONCTIONS UTILITAIRES COMPLÈTEMENT CORRIGÉES
// ==========================

// 🔹 FONCTION APPWRITE CORRIGÉE
async function callAppWriteFunction(requestData = {}) {
  try {
    console.log("🔄 Appel de la fonction AppWrite...");
    
    const appwriteUrl = `${APPWRITE_CONFIG.ENDPOINT}/functions/${APPWRITE_CONFIG.FUNCTION_ID}/executions`;
    
    // 🔥 CORRECTION : Payload correct pour AppWrite
    const payload = {
      data: JSON.stringify({
        path: requestData.path || '/api/v1/all-data/matrix-data',
        method: requestData.method || 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestData.body || null
      })
    };

    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
      },
      timeout: 30000
    };

    if (APPWRITE_CONFIG.API_KEY) {
      requestConfig.headers['X-Appwrite-Key'] = APPWRITE_CONFIG.API_KEY;
    }

    console.log("📤 Envoi à AppWrite:", { 
      url: appwriteUrl,
      payload: payload 
    });

    const response = await axios.post(appwriteUrl, payload, requestConfig);

    console.log("✅ Réponse AppWrite - Status:", response.status);

    let responseBody;

    // 🔥 CORRECTION : Extraction robuste des données
    if (response.data && response.data.responseBody) {
      // Cas 1: Données dans responseBody
      responseBody = typeof response.data.responseBody === 'string' 
        ? JSON.parse(response.data.responseBody) 
        : response.data.responseBody;
    } else if (response.data && response.data.response) {
      // Cas 2: Données dans response
      responseBody = typeof response.data.response === 'string' 
        ? JSON.parse(response.data.response) 
        : response.data.response;
    } else {
      // Cas 3: Données directes
      responseBody = response.data;
    }

    console.log("📦 Réponse AppWrite traitée:", {
      success: responseBody.success,
      dataKeys: responseBody.data ? Object.keys(responseBody.data) : 'no-data',
      membersCount: responseBody.data?.members?.length || 0,
      message: responseBody.message
    });

    return responseBody;

  } catch (err) {
    console.error("❌ Erreur appel AppWrite:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
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

// 🔹 FONCTION DE NORMALISATION ULTRA-ROBUSTE
function normalizeMemberData(members) {
  if (!Array.isArray(members)) {
    console.log("⚠️ normalizeMemberData: input n'est pas un tableau");
    return [];
  }

  return members.map((member, index) => {
    try {
      if (!member || typeof member !== 'object') {
        console.log(`⚠️ Membre ${index} invalide:`, member);
        return createFallbackMember(index);
      }

      // 🔹 CONVERSION DES SPÉCIALITÉS
      let specialties = [];
      if (Array.isArray(member.specialties)) {
        specialties = member.specialties
          .map(spec => {
            if (spec === null || spec === undefined) return null;
            return String(spec).trim();
          })
          .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
      } else if (typeof member.specialties === 'string') {
        specialties = member.specialties
          .split(/[,;|]/)
          .map(spec => spec.trim())
          .filter(spec => spec && spec !== '' && spec !== 'null' && spec !== 'undefined');
      }

      // 🔹 CONVERSION DES COMPÉTENCES
      let skills = [];
      if (Array.isArray(member.skills)) {
        skills = member.skills
          .map(skill => {
            if (skill === null || skill === undefined) return null;
            return String(skill).trim();
          })
          .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
      } else if (typeof member.skills === 'string') {
        skills = member.skills
          .split(/[,;|]/)
          .map(skill => skill.trim())
          .filter(skill => skill && skill !== '' && skill !== 'null' && skill !== 'undefined');
      }

      // 🔹 CORRECTION PHOTO
      let photoUrl = member.photo || '';
      if (photoUrl && photoUrl.startsWith('../assets/photos/')) {
        photoUrl = photoUrl.replace('../assets/photos/', '/assets/photos/');
      }

      const normalizedMember = {
        // Identifiant
        _id: member._id || member.id || generateId(),
        
        // Informations personnelles
        name: String(member.name || '').trim() || 'Nom non renseigné',
        title: String(member.title || '').trim() || 'Titre non renseigné',
        email: String(member.email || '').trim(),
        phone: String(member.phone || '').trim(),
        location: String(member.location || '').trim(),
        
        // 🔹 TABLEAUX CORRIGÉS
        specialties: specialties,
        skills: skills,
        
        // Organisation
        organization: String(member.organization || member.entreprise || '').trim(),
        entreprise: String(member.entreprise || member.organization || '').trim(),
        
        // Expérience et projets
        experienceYears: parseInt(member.experienceYears) || 0,
        projects: String(member.projects || '').trim(),
        bio: String(member.bio || member.projects || '').trim(),
        
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

      return normalizedMember;

    } catch (memberError) {
      console.error(`❌ Erreur normalisation membre ${index}:`, memberError);
      return createFallbackMember(index);
    }
  }).filter(member => member !== null);
}

// 🔹 FONCTION DE FILTRAGE CORRIGÉE
function filterMembers(members, filters) {
  if (!Array.isArray(members)) return [];
  
  let filtered = [...members];
  const { search, specialty, location, status } = filters;

  if (search && search.trim()) {
    const searchTerm = search.trim().toLowerCase();
    filtered = filtered.filter(member => {
      const searchText = `
        ${member.name || ''}
        ${member.title || ''}
        ${member.email || ''}
        ${Array.isArray(member.specialties) ? member.specialties.join(' ') : ''}
        ${Array.isArray(member.skills) ? member.skills.join(' ') : ''}
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
      return Array.isArray(member.specialties) && 
        member.specialties.some(spec => 
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

// 🔹 FONCTIONS DE FALLBACK ET DÉMO
function createFallbackMember(index) {
  return {
    _id: `fallback-${index}-${generateId()}`,
    name: `Membre ${index + 1}`,
    title: 'Information manquante',
    specialties: [],
    skills: [],
    statutMembre: 'Inactif',
    organization: '',
    isActive: false
  };
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getDemoData() {
  return [
    { 
      _id: 'demo-1', 
      name: 'Jean Dupont', 
      specialties: ['Énergie Solaire', 'Smart Grid'], 
      skills: ['Gestion de projet', 'Énergies renouvelables'], 
      location: 'Douala', 
      statutMembre: 'Actif',
      title: 'Ingénieur Senior en Énergie',
      email: 'jean.dupont@energie-cm.com',
      organization: 'Energy Solutions Cameroun',
      experienceYears: 8,
      photo: '/assets/photos/jean.jpg'
    },
    { 
      _id: 'demo-2', 
      name: 'Marie Martin', 
      specialties: ['Environnement', 'Développement Durable'], 
      skills: ['Analyse technique', 'Audit environnemental'], 
      location: 'Yaoundé', 
      statutMembre: 'Actif',
      title: 'Consultante Environnement',
      email: 'marie.martin@eco-consult.com',
      organization: 'EcoConsult Cameroun',
      experienceYears: 5,
      photo: '/assets/photos/marie.jpg'
    },
    { 
      _id: 'demo-3', 
      name: 'Paul Nkodo', 
      specialties: ['Agro-industrie', 'Sylviculture'], 
      skills: ['Développement rural', 'Gestion de projets agricoles'], 
      location: 'Bafoussam', 
      statutMembre: 'Actif',
      title: 'Agronome Senior',
      email: 'paul.nkodo@agro-cm.com',
      organization: 'AgroTech Cameroun',
      experienceYears: 12,
      photo: '/assets/photos/paul.jpg'
    }
  ];
}

function getDemoProjects() {
  return [
    {
      _id: 'project-1',
      title: 'Centrale Solaire Rurale',
      description: 'Installation de mini-centrales solaires dans les zones rurales',
      status: 'active',
      organization: 'Energy Solutions Cameroun',
      members: ['demo-1']
    }
  ];
}

function getDemoGroups() {
  return [
    {
      _id: 'group-1',
      name: 'Équipe Énergie Renouvelable',
      description: 'Groupe dédié aux projets énergétiques',
      type: 'technique',
      members: ['demo-1', 'demo-2']
    }
  ];
}

// ==========================
// ROUTES SUPPLEMENTAIRES
// ==========================

router.get("/stats/summary", async (req, res) => {
  try {
    console.log("📊 Récupération des statistiques");

    const appwriteResponse = await callAppWriteFunction({
      path: '/api/v1/all-data/matrix-data',
      method: 'GET'
    });
    
    let allMembers = [];
    let source = 'appwrite';

    if (appwriteResponse.success && appwriteResponse.data) {
      allMembers = appwriteResponse.data.members || [];
    } else {
      allMembers = getDemoData();
      source = 'demo';
    }

    const normalizedMembers = normalizeMemberData(allMembers);
    const stats = calculateStats(normalizedMembers);

    res.json({
      success: true,
      stats: stats,
      source: source,
      totalMembers: normalizedMembers.length,
      timestamp: new Date().toISOString()
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

    const appwriteResponse = await callAppWriteFunction({
      path: '/api/v1/all-data/matrix-data',
      method: 'GET'
    });
    
    let allMembers = [];

    if (appwriteResponse.success && appwriteResponse.data) {
      allMembers = appwriteResponse.data.members || [];
    } else {
      allMembers = getDemoData();
    }

    const normalizedMembers = normalizeMemberData(allMembers);
    const metadata = extractMetadata(normalizedMembers);

    res.json({
      success: true,
      metadata: metadata,
      totalMembers: normalizedMembers.length,
      timestamp: new Date().toISOString()
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

// 🔹 CALCUL DES STATISTIQUES
function calculateStats(members) {
  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.statutMembre === 'Actif').length;
  
  const locationStats = {};
  const specialtyStats = {};
  const orgStats = {};

  members.forEach(member => {
    // Localisations
    if (member.location) {
      locationStats[member.location] = (locationStats[member.location] || 0) + 1;
    }

    // Spécialités
    if (Array.isArray(member.specialties)) {
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

// 🔹 EXTRACTION DES MÉTADONNÉES
function extractMetadata(members) {
  const specialties = new Set();
  const locations = new Set();
  const organizations = new Set();
  const statuses = new Set();

  members.forEach(member => {
    if (Array.isArray(member.specialties)) {
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

// Routes de debug
router.get("/debug/appwrite", async (req, res) => {
  try {
    console.log("🐛 Test connexion AppWrite");
    
    const result = await callAppWriteFunction({
      path: '/api/v1/health',
      method: 'GET'
    });
    
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
    version: "2.0.0",
    appwrite: {
      endpoint: APPWRITE_CONFIG.ENDPOINT,
      projectId: APPWRITE_CONFIG.PROJECT_ID,
      functionId: APPWRITE_CONFIG.FUNCTION_ID,
      status: 'configured'
    }
  });
});

module.exports = router;
