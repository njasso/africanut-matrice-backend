// src/services/api.js - VERSION COMPLÈTEMENT CORRIGÉE
import axios from "axios";

// Configuration Appwrite
const APPWRITE_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: '6917d4340008cda26023',
  functionId: '6917e0420005d9ac19c9',
  apiKey: 'standard_00e71a77107d8a21d3b2cb2c16c07b33c2b61e16a0d3cacfee7969f327ac197ce2fcdd90bbe54297b54a975fe2d9b4128bc2fc90ad63d19e0984a961a368d8e9c7ba6368427afc80386b6131fbd18d456af672c675d17fe413a5877fdfe5ef6c0934c4a40a4b9623a3f205b7f94b184ca8d98b1ad6edcf08c40daadc1f2f02d8'
};

// Cache
const responseCache = new Map();
const CACHE_DURATION = 30000;

// 🔥 FONCTION PRINCIPALE CORRIGÉE
const executeAppWriteFunction = async (routePath, method = 'GET', data = null, options = {}) => {
  const { useCache = true, maxRetries = 2 } = options;
  const cacheKey = useCache ? `${method}:${routePath}:${JSON.stringify(data)}` : null;

  // Vérifier le cache
  if (useCache && cacheKey && responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("⚡ Données depuis le cache:", cacheKey);
      return {
        data: cached.data,
        status: 200,
        isMock: false,
        fromCache: true
      };
    }
  }

  try {
    console.log(`🚀 AppWrite Execution: ${method} ${routePath}`);
    
    // 🔥 CORRECTION : Structure correcte pour Appwrite
    const payload = {
      path: routePath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(data && { body: JSON.stringify(data) })
    };

    const response = await axios.post(
      `${APPWRITE_CONFIG.endpoint}/functions/${APPWRITE_CONFIG.functionId}/executions`,
      {
        data: JSON.stringify(payload),
        async: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
          'X-Appwrite-Key': APPWRITE_CONFIG.apiKey
        },
        timeout: 30000
      }
    );

    console.log("📨 Réponse AppWrite reçue");

    let resultData = response.data;
    
    // Extraire les données de responseBody
    if (resultData && typeof resultData.responseBody === 'string') {
      try {
        resultData = JSON.parse(resultData.responseBody);
      } catch (parseError) {
        console.warn("❌ Erreur parsing responseBody:", parseError);
      }
    }

    if (resultData && resultData.success !== false) {
      // Mettre en cache
      if (useCache && cacheKey) {
        responseCache.set(cacheKey, {
          data: resultData,
          timestamp: Date.now()
        });
      }
      
      return {
        data: resultData,
        status: response.status,
        isMock: false,
        fromCache: false
      };
    } else {
      throw new Error(resultData?.message || 'Erreur Appwrite');
    }

  } catch (error) {
    console.error(`❌ AppWrite Error: ${error.message}`);
    
    // Retry
    if (maxRetries > 0) {
      console.log(`🔄 Retry (${maxRetries} left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return executeAppWriteFunction(routePath, method, data, { 
        ...options, 
        maxRetries: maxRetries - 1 
      });
    }
    
    // Fallback mock
    console.log('🔄 Using mock data');
    const mockData = getMockData(routePath, method, data);
    
    return {
      data: mockData,
      status: 200,
      isMock: true,
      error: error.message
    };
  }
};

// 🔥 FONCTION SPÉCIALE POUR TOUTES LES DONNÉES
const getAllMatrixData = async () => {
  return executeAppWriteFunction('/api/v1/all-data/matrix-data', 'GET', null, { useCache: true });
};

// Données mock améliorées
const getMockData = (path, method = 'GET', requestData = null) => {
  console.log(`🔄 Mock data for: ${method} ${path}`);

  const baseMockData = {
    '/api/v1/all-data/matrix-data': {
      success: true,
      data: {
        members: [
          {
            _id: "mock-member-1",
            name: "Jean Dupont",
            title: "Développeur Fullstack",
            email: "jean.dupont@example.com",
            organization: "Tech Corp",
            specialties: ["JavaScript", "React", "Node.js"],
            skills: ["Frontend", "Backend", "DevOps"],
            location: "Paris, France",
            experienceYears: 5,
            projects: ["Projet Alpha"],
            availability: "Disponible",
            statutMembre: "Actif",
            isActive: true,
            phone: "+33 1 23 45 67 89",
            bio: "Développeur passionné avec 5 ans d'expérience"
          },
          {
            _id: "mock-member-2", 
            name: "Marie Martin",
            title: "Designer UX/UI",
            email: "marie.martin@example.com",
            organization: "Design Studio",
            specialties: ["UI Design", "User Research"],
            skills: ["Figma", "Adobe XD", "User Testing"],
            location: "Lyon, France",
            experienceYears: 3,
            projects: ["Projet Beta"],
            availability: "Partiellement disponible",
            statutMembre: "Actif",
            isActive: true,
            phone: "+33 4 56 78 90 12",
            bio: "Designer UX/UI créative"
          }
        ],
        skills: [
          { _id: "skill-1", name: "JavaScript", category: "technique" },
          { _id: "skill-2", name: "React", category: "technique" },
          { _id: "skill-3", name: "Figma", category: "design" }
        ],
        specialties: [
          { _id: "spec-1", name: "Développement Frontend", category: "technique" },
          { _id: "spec-2", name: "Design UX/UI", category: "design" }
        ],
        projects: [
          {
            _id: "project-1",
            name: "Projet Alpha",
            title: "Application Web",
            description: "Développement d'une application web moderne",
            status: "active",
            members: ["mock-member-1"]
          }
        ],
        interactions: [
          {
            _id: "interaction-1",
            type: "message",
            title: "Réunion projet",
            from: "mock-member-1",
            to: ["mock-member-2"],
            status: "completed"
          }
        ]
      },
      metadata: {
        totals: {
          members: 2,
          skills: 3,
          specialties: 2,
          projects: 1,
          interactions: 1
        }
      }
    }
  };

  return baseMockData[path] || { 
    success: true, 
    message: `Mock for ${path}`,
    isMock: true
  };
};

// 🔥 SERVICE API CORRIGÉ
export const apiService = {
  // Données complètes
  getAllMatrixData,
  
  // Test connexion
  testConnection: () => executeAppWriteFunction('/api/v1/health', 'GET'),
  
  // Autres endpoints
  getMembers: () => executeAppWriteFunction('/api/v1/members', 'GET'),
  getSkills: () => executeAppWriteFunction('/api/v1/skills', 'GET'),
  getSpecialties: () => executeAppWriteFunction('/api/v1/specialties', 'GET'),
  getProjects: () => executeAppWriteFunction('/api/v1/projects', 'GET'),
  getInteractions: () => executeAppWriteFunction('/api/v1/interactions', 'GET'),
  
  // CRUD
  createMember: (data) => executeAppWriteFunction('/api/v1/members', 'POST', data),
  createInteraction: (data) => executeAppWriteFunction('/api/v1/interactions', 'POST', data),
  
  // Utilitaires
  clearCache: () => {
    responseCache.clear();
    console.log("🧹 Cache cleared");
  }
};

export default apiService;
