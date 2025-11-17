// routes/members.js - VERSION CONNECTÉE À APPWRITE
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
  console.log(`📨 ${req.method} ${req.originalUrl}`);
  next();
});

// ==========================
// ROUTES PRINCIPALES - CONNECTÉES À APPWRITE
// ==========================

// 🔹 GET tous les membres depuis AppWrite
router.get("/", async (req, res) => {
  try {
    console.log("🔍 Route /members appelée - Récupération depuis AppWrite");
    
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
      return res.status(500).json(appwriteResponse);
    }

    let allMembers = appwriteResponse.data.members || [];
    
    console.log(`📊 ${allMembers.length} membres reçus d'AppWrite`);

    // 🔍 FILTRAGE LOCAL des données
    let filteredMembers = [...allMembers];

    // Filtre recherche texte
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredMembers = filteredMembers.filter(member => 
        JSON.stringify(member).toLowerCase().includes(searchTerm)
      );
    }

    // Filtre spécialité
    if (specialty && specialty.trim()) {
      const specialtyTerm = specialty.trim().toLowerCase();
      filteredMembers = filteredMembers.filter(member => {
        const specialties = Array.isArray(member.specialties) ? member.specialties : [member.specialties];
        return specialties.some(spec => 
          spec && spec.toLowerCase().includes(specialtyTerm)
        );
      });
    }

    // Filtre localisation
    if (location && location.trim()) {
      const locationTerm = location.trim().toLowerCase();
      filteredMembers = filteredMembers.filter(member => 
        member.location && member.location.toLowerCase().includes(locationTerm)
      );
    }

    // Filtre statut
    if (status && status.trim()) {
      const statusTerm = status.trim().toLowerCase();
      filteredMembers = filteredMembers.filter(member => 
        member.statutMembre && member.statutMembre.toLowerCase().includes(statusTerm)
      );
    }

    // 📄 PAGINATION
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

    // Normalisation des données
    const normalizedMembers = normalizeMemberData(paginatedMembers);

    res.json({ 
      success: true, 
      data: normalizedMembers,
      total: filteredMembers.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filteredMembers.length / parseInt(limit)),
      filters: {
        search: search || '',
        specialty: specialty || '',
        location: location || '',
        status: status || ''
      }
    });

  } catch (err) {
    console.error("❌ Erreur GET /members:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors du chargement des membres", 
      error: err.message
    });
  }
});

// 🔹 GET un membre par ID depuis AppWrite
router.get("/:id", async (req, res) => {
  try {
    console.log("🔍 Récupération membre ID depuis AppWrite:", req.params.id);
    
    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json(appwriteResponse);
    }

    const allMembers = appwriteResponse.data.members || [];
    const member = allMembers.find(m => m._id === req.params.id);

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé" 
      });
    }

    // Normalisation des données
    const normalizedMember = normalizeMemberData([member])[0];

    res.json({ 
      success: true, 
      data: normalizedMember 
    });

  } catch (err) {
    console.error("❌ Erreur GET /members/:id:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la récupération du membre", 
      error: err.message 
    });
  }
});

// 🔹 GET toutes les collections depuis AppWrite
router.get("/collections/all", async (req, res) => {
  try {
    console.log("🗂️ Récupération de toutes les collections depuis AppWrite");

    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json(appwriteResponse);
    }

    const allData = appwriteResponse.data || {};
    
    // Statistiques
    const stats = {};
    Object.keys(allData).forEach(collection => {
      stats[collection] = Array.isArray(allData[collection]) ? allData[collection].length : 0;
    });

    console.log(`📈 Collections reçues: ${Object.keys(allData).join(', ')}`);

    res.json({
      success: true,
      data: allData,
      collections: Object.keys(allData),
      statistics: stats,
      totalCollections: Object.keys(allData).length
    });

  } catch (err) {
    console.error("❌ Erreur GET /members/collections/all:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors de la récupération des collections", 
      error: err.message 
    });
  }
});

// 🔹 GET statistiques depuis AppWrite
router.get("/stats/summary", async (req, res) => {
  try {
    console.log("📊 Récupération des statistiques depuis AppWrite");

    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json(appwriteResponse);
    }

    const allMembers = appwriteResponse.data.members || [];
    
    // Calcul des statistiques
    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.statutMembre === 'Actif').length;
    
    // Statistiques par localisation
    const locationStats = {};
    allMembers.forEach(member => {
      if (member.location) {
        locationStats[member.location] = (locationStats[member.location] || 0) + 1;
      }
    });

    // Statistiques par spécialité
    const specialtyStats = {};
    allMembers.forEach(member => {
      const specialties = Array.isArray(member.specialties) ? member.specialties : [member.specialties];
      specialties.forEach(spec => {
        if (spec) {
          specialtyStats[spec] = (specialtyStats[spec] || 0) + 1;
        }
      });
    });

    // Top organisations
    const orgStats = {};
    allMembers.forEach(member => {
      const org = member.organization || member.entreprise;
      if (org) {
        orgStats[org] = (orgStats[org] || 0) + 1;
      }
    });

    res.json({
      success: true,
      stats: {
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
      }
    });

  } catch (err) {
    console.error("❌ Erreur GET /members/stats/summary:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors du calcul des statistiques", 
      error: err.message 
    });
  }
});

// 🔹 GET métadonnées pour les filtres
router.get("/metadata/filters", async (req, res) => {
  try {
    console.log("🎯 Récupération des métadonnées pour filtres");

    const appwriteResponse = await callAppWriteFunction();
    
    if (!appwriteResponse.success) {
      return res.status(500).json(appwriteResponse);
    }

    const allMembers = appwriteResponse.data.members || [];
    
    // Extraction des valeurs uniques
    const specialties = new Set();
    const locations = new Set();
    const organizations = new Set();
    const statuses = new Set();

    allMembers.forEach(member => {
      // Spécialités
      if (member.specialties) {
        const specs = Array.isArray(member.specialties) ? member.specialties : [member.specialties];
        specs.forEach(spec => spec && specialties.add(spec));
      }
      
      // Localisations
      if (member.location) locations.add(member.location);
      
      // Organisations
      const org = member.organization || member.entreprise;
      if (org) organizations.add(org);
      
      // Statuts
      if (member.statutMembre) statuses.add(member.statutMembre);
    });

    res.json({
      success: true,
      metadata: {
        specialties: Array.from(specialties).sort(),
        locations: Array.from(locations).sort(),
        organizations: Array.from(organizations).sort(),
        statuses: Array.from(statuses).sort()
      }
    });

  } catch (err) {
    console.error("❌ Erreur GET /members/metadata/filters:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur lors du chargement des métadonnées", 
      error: err.message 
    });
  }
});

// ==========================
// FONCTIONS UTILITAIRES
// ==========================

// 🔹 Fonction pour appeler AppWrite
async function callAppWriteFunction() {
  try {
    console.log("🔄 Appel de la fonction AppWrite...");
    
    const appwriteUrl = `${APPWRITE_CONFIG.ENDPOINT}/functions/${APPWRITE_CONFIG.FUNCTION_ID}/executions`;
    
    console.log("📡 URL AppWrite:", appwriteUrl);
    console.log("🔑 Project ID:", APPWRITE_CONFIG.PROJECT_ID);

    const response = await axios.post(
      appwriteUrl,
      {}, // Body vide
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
          'Authorization': APPWRITE_CONFIG.API_KEY ? `Bearer ${APPWRITE_CONFIG.API_KEY}` : undefined
        },
        timeout: 30000
      }
    );

    console.log("✅ Réponse AppWrite reçue, statut:", response.status);

    // Gestion de la réponse AppWrite
    if (response.data && response.data.response) {
      try {
        const responseBody = typeof response.data.response === 'string' 
          ? JSON.parse(response.data.response) 
          : response.data.response;

        console.log("📦 Données brutes AppWrite:", {
          success: responseBody.success,
          dataKeys: responseBody.data ? Object.keys(responseBody.data) : 'no data',
          collections: responseBody.collections || 'no collections'
        });

        return responseBody;

      } catch (parseError) {
        console.error("❌ Erreur parsing réponse AppWrite:", parseError);
        return {
          success: false,
          message: "Erreur de format de réponse AppWrite",
          error: parseError.message
        };
      }
    } else {
      console.error("❌ Réponse AppWrite invalide:", response.data);
      return {
        success: false,
        message: "Réponse invalide d'AppWrite",
        data: response.data
      };
    }

  } catch (err) {
    console.error("❌ Erreur appel AppWrite:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
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

// 🔹 Fonction de normalisation des données
function normalizeMemberData(members) {
  return members.map(member => ({
    ...member,
    specialties: Array.isArray(member.specialties) 
      ? member.specialties 
      : (member.specialties ? [member.specialties] : []),
    skills: Array.isArray(member.skills) 
      ? member.skills 
      : (member.skills ? [member.skills] : []),
    organization: member.organization || member.entreprise || '',
    location: member.location || '',
    statutMembre: member.statutMembre || 'Actif',
    title: member.title || '',
    email: member.email || '',
    phone: member.phone || ''
  }));
}

// 🔹 Route de test AppWrite
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
      appwriteResponse: result
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

module.exports = router;
