// routes/members.js - VERSION AVEC VOTRE ENDPOINT APPWRITE
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Configuration AppWrite avec VOTRE ENDPOINT
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
    console.log("🔍 Route /members - Récupération depuis AppWrite Fra");
    
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
    
    console.log(`📊 ${allMembers.length} membres reçus d'AppWrite Frankfurt`);

    // Si pas de données, mode démo
    if (allMembers.length === 0) {
      console.log("🔄 Aucune donnée reçue, activation mode démonstration");
      allMembers = getDemoData();
    }

    // 🔍 FILTRAGE LOCAL
    let filteredMembers = filterMembers(allMembers, { search, specialty, location, status });

    // 📄 PAGINATION
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    // Normalisation
    const normalizedMembers = normalizeMemberData(paginatedMembers);

    res.json({ 
      success: true, 
      data: normalizedMembers,
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
    const member = allMembers.find(m => m._id === req.params.id || m.id === req.params.id);

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé" 
      });
    }

    const normalizedMember = normalizeMemberData([member])[0];

    res.json({ 
      success: true, 
      data: normalizedMember,
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
    
    // Statistiques
    const stats = {};
    Object.keys(allData).forEach(collection => {
      stats[collection] = Array.isArray(allData[collection]) ? allData[collection].length : 0;
    });

    console.log(`📈 Collections Frankfurt: ${Object.keys(allData).join(', ')}`);

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

// 🔹 GET statistiques
router.get("/stats/summary", async (req, res) => {
  try {
    console.log("📊 Récupération des statistiques");

    const appwriteResponse = await callAppWriteFunction();
    
    let allMembers = [];
    let source = 'appwrite';

    if (appwriteResponse.success) {
      allMembers = appwriteResponse.data?.members || [];
    } else {
      // Fallback vers les données de démonstration
      allMembers = getDemoData();
      source = 'demo';
      console.log("🔄 Utilisation des données de démonstration pour les stats");
    }

    // Calcul des statistiques
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

// 🔹 GET métadonnées pour les filtres
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

// ==========================
// FONCTIONS UTILITAIRES
// ==========================

// 🔹 Fonction pour appeler AppWrite Frankfurt
async function callAppWriteFunction() {
  try {
    console.log("🔄 Appel de la fonction AppWrite Frankfurt...");
    
    const appwriteUrl = `${APPWRITE_CONFIG.ENDPOINT}/functions/${APPWRITE_CONFIG.FUNCTION_ID}/executions`;
    
    console.log("📍 URL AppWrite:", appwriteUrl);
    console.log("🔑 Project ID:", APPWRITE_CONFIG.PROJECT_ID);

    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
      },
      timeout: 25000
    };

    // Ajout de l'API Key si disponible
    if (APPWRITE_CONFIG.API_KEY) {
      requestConfig.headers['X-Appwrite-Key'] = APPWRITE_CONFIG.API_KEY;
    }

    const response = await axios.post(appwriteUrl, {}, requestConfig);

    console.log("✅ Réponse AppWrite Frankfurt - Status:", response.status);

    // Gestion de la réponse AppWrite
    if (response.data && response.data.response) {
      try {
        const responseBody = typeof response.data.response === 'string' 
          ? JSON.parse(response.data.response) 
          : response.data.response;

        console.log("📦 Structure réponse:", {
          success: responseBody.success,
          dataKeys: responseBody.data ? Object.keys(responseBody.data) : 'no data',
          membersCount: responseBody.data?.members?.length || 0
        });

        return responseBody;

      } catch (parseError) {
        console.error("❌ Erreur parsing JSON:", parseError);
        return {
          success: false,
          message: "Erreur de format JSON dans la réponse",
          error: parseError.message
        };
      }
    } else {
      console.error("❌ Réponse AppWrite invalide - Structure:", response.data);
      return {
        success: false,
        message: "Réponse invalide d'AppWrite",
        responseData: response.data
      };
    }

  } catch (err) {
    console.error("❌ Erreur appel AppWrite Frankfurt:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText
    });

    // Détails supplémentaires pour le debugging
    if (err.response) {
      console.error("📋 Détails erreur:", {
        status: err.response.status,
        headers: err.response.headers,
        data: err.response.data
      });
    }

    return {
      success: false,
      message: "Erreur de connexion à AppWrite Frankfurt",
      error: err.message,
      code: err.code,
      status: err.response?.status
    };
  }
}

// 🔹 Fonction de filtrage
function filterMembers(members, filters) {
  let filtered = [...members];
  const { search, specialty, location, status } = filters;

  if (search && search.trim()) {
    const searchTerm = search.trim().toLowerCase();
    filtered = filtered.filter(member => 
      JSON.stringify(member).toLowerCase().includes(searchTerm)
    );
  }

  if (specialty && specialty.trim()) {
    const specialtyTerm = specialty.trim().toLowerCase();
    filtered = filtered.filter(member => {
      const specialties = Array.isArray(member.specialties) ? member.specialties : [member.specialties];
      return specialties.some(spec => 
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

  return filtered;
}

// 🔹 Fonction de normalisation
function normalizeMemberData(members) {
  return members.map(member => ({
    _id: member._id || member.id,
    name: member.name || '',
    title: member.title || '',
    email: member.email || '',
    phone: member.phone || '',
    location: member.location || '',
    specialties: Array.isArray(member.specialties) 
      ? member.specialties 
      : (member.specialties ? [member.specialties] : []),
    skills: Array.isArray(member.skills) 
      ? member.skills 
      : (member.skills ? [member.skills] : []),
    organization: member.organization || member.entreprise || '',
    projects: member.projects || '',
    bio: member.bio || '',
    statutMembre: member.statutMembre || 'Actif',
    experienceYears: member.experienceYears || 0,
    photo: member.photo || ''
  }));
}

// 🔹 Fonction de calcul des statistiques
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
    const specialties = Array.isArray(member.specialties) ? member.specialties : [member.specialties];
    specialties.forEach(spec => {
      if (spec) {
        specialtyStats[spec] = (specialtyStats[spec] || 0) + 1;
      }
    });

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

// 🔹 Extraction des métadonnées
function extractMetadata(members) {
  const specialties = new Set();
  const locations = new Set();
  const organizations = new Set();
  const statuses = new Set();

  members.forEach(member => {
    if (member.specialties) {
      const specs = Array.isArray(member.specialties) ? member.specialties : [member.specialties];
      specs.forEach(spec => spec && specialties.add(spec));
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

// 🔹 Données de démonstration
function getDemoData() {
  return [
    { 
      _id: '1', 
      name: 'Jean Dupont', 
      specialties: ['Énergie Solaire', 'Smart Grid'], 
      skills: ['Gestion de projet', 'Énergies renouvelables'], 
      location: 'Douala', 
      statutMembre: 'Actif',
      title: 'Ingénieur Senior en Énergie',
      email: 'jean.dupont@energie-cm.com',
      organization: 'Energy Solutions Cameroun'
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
      organization: 'EcoConsult Cameroun'
    }
  ];
}

// 🔹 Route de test et debug
router.get("/debug/appwrite", async (req, res) => {
  try {
    console.log("🐛 Test connexion AppWrite Frankfurt");
    
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

// 🔹 Health check
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
