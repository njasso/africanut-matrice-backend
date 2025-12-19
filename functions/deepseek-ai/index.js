import { MongoClient, ObjectId } from 'mongodb';

// ========== CONFIGURATION ==========
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "matrice";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

// Cache pour la connexion MongoDB
let mongoClient = null;

async function getDatabase() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db(MONGODB_DB_NAME);
}

// ========== DEEPSEEK API SERVICE ==========
async function callDeepSeekAPI(messages, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured. Please set DEEPSEEK_API_KEY environment variable.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'deepseek-chat',
        messages,
        max_tokens: options.max_tokens || 1000,
        temperature: options.temperature || 0.7,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('DeepSeek API timeout after 30 seconds');
    }
    throw error;
  }
}

// ========== AI SERVICES ==========

// 1. Test de connexion simple
async function testConnection() {
  const response = await callDeepSeekAPI([
    { role: 'user', content: 'Réponds uniquement par "OK" si tu fonctionnes.' }
  ], {
    max_tokens: 10,
    temperature: 0.1
  });

  return {
    status: 'connected',
    response: response.choices[0]?.message?.content,
    model: response.model,
    timestamp: new Date().toISOString()
  };
}

// 2. Analyse de synergie entre membres (compatible avec votre structure)
async function analyzeSynergy(data) {
  const { member1, member2, project, context } = data;
  
  if (!member1 || !member2) {
    throw new Error('Both member1 and member2 IDs are required');
  }

  const db = await getDatabase();
  
  // Récupération des données depuis MongoDB (compatible avec vos autres fonctions)
  const [member1Data, member2Data, projectData] = await Promise.all([
    db.collection('members').findOne({ _id: new ObjectId(member1) }),
    db.collection('members').findOne({ _id: new ObjectId(member2) }),
    project ? db.collection('projects').findOne({ _id: new ObjectId(project) }) : Promise.resolve(null)
  ]);

  if (!member1Data || !member2Data) {
    throw new Error('One or both members not found');
  }

  // Construction du prompt optimisé
  const prompt = `
    Analyse de synergie professionnelle - Format structuré

    CONTEXTE: ${context || 'Collaboration générale entre collaborateurs'}

    PROFIL 1:
    - Nom: ${member1Data.name || 'Non renseigné'}
    - Poste: ${member1Data.title || 'Non spécifié'}
    - Compétences techniques: ${Array.isArray(member1Data.skills) ? member1Data.skills.join(', ') : 'Non spécifié'}
    - Spécialités: ${Array.isArray(member1Data.specialties) ? member1Data.specialties.join(', ') : 'Non spécifié'}
    ${member1Data.experienceYears ? `- Expérience: ${member1Data.experienceYears} ans` : ''}
    ${member1Data.organization ? `- Organisation: ${member1Data.organization}` : ''}

    PROFIL 2:
    - Nom: ${member2Data.name || 'Non renseigné'}
    - Poste: ${member2Data.title || 'Non spécifié'}
    - Compétences techniques: ${Array.isArray(member2Data.skills) ? member2Data.skills.join(', ') : 'Non spécifié'}
    - Spécialités: ${Array.isArray(member2Data.specialties) ? member2Data.specialties.join(', ') : 'Non spécifié'}
    ${member2Data.experienceYears ? `- Expérience: ${member2Data.experienceYears} ans` : ''}
    ${member2Data.organization ? `- Organisation: ${member2Data.organization}` : ''}

    ${projectData ? `
    PROJET:
    - Titre: ${projectData.title || 'Non spécifié'}
    - Description: ${projectData.description || 'Non spécifiée'}
    ${Array.isArray(projectData.tags) ? `- Tags: ${projectData.tags.join(', ')}` : ''}
    ` : ''}

    ANALYSE REQUISE:
    Fournis une analyse en français avec les sections suivantes:

    🔍 COMPLÉMENTARITÉ (Score 1-10)
    • Justification du score
    • Points forts de cette combinaison
    • Compétences complémentaires identifiées

    ⚠️ POINTS DE VIGILANCE
    • Risques potentiels
    • Éléments à surveiller
    • Défis anticipés

    🎯 RECOMMANDATIONS PRATIQUES
    1. Pour maximiser la collaboration
    2. Pour le manager/chef de projet
    3. Pour les ressources RH

    📊 IMPACT POTENTIEL
    • Sur la productivité
    • Sur l'innovation
    • Sur la dynamique d'équipe

    Ton: Professionnel, factuel, pragmatique. Maximum 400 mots.
  `;

  const response = await callDeepSeekAPI([
    {
      role: 'system',
      content: `Tu es un expert en ressources humaines et optimisation d'équipes avec 15 ans d'expérience.
                Tu analyses les synergies professionnelles avec précision et fournis des recommandations actionnables.
                Tu réponds toujours en français avec un ton professionnel.`
    },
    { role: 'user', content: prompt }
  ]);

  const analysis = response.choices[0]?.message?.content;

  // Sauvegarde dans la collection 'analyses' (compatible avec analyses-crud)
  const analysisRecord = {
    type: 'synergy_analysis',
    title: `Synergie: ${member1Data.name} & ${member2Data.name}`,
    description: `Analyse de synergie générée par IA`,
    member1: member1,
    member2: member2,
    project: project || null,
    analysis: analysis,
    insights: {
      member1Name: member1Data.name,
      member2Name: member2Data.name,
      projectName: projectData?.title || null,
      generatedAt: new Date()
    },
    statistics: {
      aiModel: 'deepseek-chat',
      tokensUsed: response.usage?.total_tokens || 0,
      processingTime: 'ai_enhanced'
    },
    status: 'completed',
    analysisTimestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Utilise la même collection que votre fonction analyses-crud
  const result = await db.collection('analyses').insertOne(analysisRecord);

  return {
    success: true,
    analysis: analysis,
    analysisId: result.insertedId.toString(),
    members: {
      member1: { id: member1, name: member1Data.name },
      member2: { id: member2, name: member2Data.name }
    },
    project: projectData ? { id: project, title: projectData.title } : null,
    metadata: {
      model: response.model,
      tokens: response.usage,
      timestamp: new Date().toISOString()
    }
  };
}

// 3. Recommandations pour composition d'équipe
async function recommendTeam(data) {
  const { projectId, teamSize = 4, requiredSkills = [] } = data;
  
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) {
    throw new Error('Project not found');
  }

  // Récupère tous les membres actifs (compatible avec get-matrice)
  const members = await db.collection('members')
    .find({ 
      isActive: true,
      ...(requiredSkills.length > 0 ? {
        skills: { $in: requiredSkills }
      } : {})
    })
    .project({ name: 1, title: 1, skills: 1, specialties: 1, experienceYears: 1, organization: 1 })
    .toArray();

  if (members.length === 0) {
    throw new Error('No active members found' + (requiredSkills.length > 0 ? ' with required skills' : ''));
  }

  const prompt = `
    Composition d'équipe optimale - Analyse IA

    PROJET:
    - Titre: ${project.title}
    - Description: ${project.description || 'Non spécifiée'}
    ${Array.isArray(project.tags) ? `- Technologies/Tags: ${project.tags.join(', ')}` : ''}
    ${project.status ? `- Statut: ${project.status}` : ''}

    CONTRAINTES:
    - Taille équipe cible: ${teamSize} personnes
    ${requiredSkills.length > 0 ? `- Compétences requises: ${requiredSkills.join(', ')}` : ''}
    - Membres disponibles: ${members.length} personnes

    PROFILS DISPONIBLES:
    ${members.map((m, i) => `
    ${i+1}. ${m.name}
        • Poste: ${m.title || 'Non spécifié'}
        • Compétences: ${Array.isArray(m.skills) ? m.skills.slice(0, 5).join(', ') : 'Non spécifié'}
        • Spécialités: ${Array.isArray(m.specialties) ? m.specialties.slice(0, 3).join(', ') : 'Non spécifié'}
        ${m.experienceYears ? `• Expérience: ${m.experienceYears} ans` : ''}
    `).join('\n')}

    TÂCHE:
    Propose 3 scénarios d'équipe différents en fonction des objectifs:

    🥇 ÉQUIPE OPTIMALE (Performance maximale)
    • Composition idéale
    • Justification par profil
    • Rôles recommandés

    ⚖️ ÉQUIPE ÉQUILIBRÉE (Compromis optimal)
    • Bon rapport compétences/expérience
    • Diversité des profils
    • Facile à manager

    💡 ÉQUIPE INNOVANTE (Creative & Risque)
    • Profils disruptifs
    • Potentiel d'innovation
    • Management adapté

    Pour chaque scénario:
    1. Liste des membres recommandés (noms)
    2. Structure de l'équipe (rôles)
    3. Forces principales
    4. Points d'attention
    5. Recommandations de management

    Format: Structuré, clair, prêt à l'emploi. Maximum 500 mots.
  `;

  const response = await callDeepSeekAPI([
    {
      role: 'system',
      content: `Tu es un consultant expert en composition d'équipes et management de projet.
                Tu as une expérience internationale dans des entreprises tech.
                Tu fournis des analyses pragmatiques et actionnables.`
    },
    { role: 'user', content: prompt }
  ]);

  return {
    success: true,
    project: { id: projectId, title: project.title },
    recommendations: response.choices[0]?.message?.content,
    metadata: {
      totalMembersConsidered: members.length,
      teamSizeRequested: teamSize,
      requiredSkills: requiredSkills,
      timestamp: new Date().toISOString(),
      model: response.model
    }
  };
}

// 4. Chat générique pour autres usages
async function chatCompletion(data) {
  const { messages, model, temperature, max_tokens } = data;
  
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Messages array is required');
  }

  const response = await callDeepSeekAPI(messages, {
    model,
    temperature,
    max_tokens
  });

  return {
    success: true,
    response: response.choices[0]?.message?.content,
    usage: response.usage,
    model: response.model
  };
}

// ========== ROUTER ==========
const router = {
  // Test endpoint
  'POST /test': async () => ({
    success: true,
    ...await testConnection()
  }),

  // Analyse de synergie
  'POST /synergy': async (body) => ({
    success: true,
    ...await analyzeSynergy(body)
  }),

  // Recommandations d'équipe
  'POST /team': async (body) => ({
    success: true,
    ...await recommendTeam(body)
  }),

  // Chat générique
  'POST /chat': async (body) => ({
    success: true,
    ...await chatCompletion(body)
  }),

  // Génération de contenu (descriptions, emails, etc.)
  'POST /generate': async (body) => {
    const { type, content, context } = body;
    
    const prompts = {
      project_description: `Génère une description professionnelle de projet:\n${content}\nContexte: ${context}`,
      email: `Rédige un email professionnel:\n${content}\nTon: ${context || 'professionnel'}`,
      summary: `Fais un résumé structuré de:\n${content}`,
      ideas: `Génère des idées créatives pour:\n${content}`
    };

    const prompt = prompts[type] || `Tâche: ${type}\nContenu: ${content}\nContexte: ${context}`;

    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'Tu es un assistant professionnel spécialisé dans la rédaction et la génération de contenu.'
      },
      { role: 'user', content: prompt }
    ]);

    return {
      success: true,
      content: response.choices[0]?.message?.content,
      type,
      model: response.model
    };
  }
};

// ========== MAIN HANDLER ==========
export default async function handler({ req, res, log, error }) {
  log(`🤖 DeepSeek AI - ${req.method} ${req.path || '/'}`);

  try {
    const { method, path, body } = req;
    
    // Parse le body
    let bodyData = {};
    if (body) {
      try {
        bodyData = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {
        return res.json({
          success: false,
          error: 'Invalid JSON body',
          timestamp: new Date().toISOString()
        }, 400);
      }
    }

    // Route par défaut (GET /)
    if (method === 'GET' && (!path || path === '/')) {
      return res.json({
        success: true,
        service: 'DeepSeek AI Integration',
        version: '1.0.0',
        endpoints: [
          'POST /test - Test connection',
          'POST /synergy - Analyze member synergy',
          'POST /team - Recommend team composition',
          'POST /chat - Generic chat completion',
          'POST /generate - Content generation'
        ],
        timestamp: new Date().toISOString()
      });
    }

    // Trouver la route
    const routeKey = `${method} ${path}`;
    const routeHandler = router[routeKey];

    if (!routeHandler) {
      return res.json({
        success: false,
        error: 'Route not found',
        availableRoutes: Object.keys(router),
        timestamp: new Date().toISOString()
      }, 404);
    }

    // Exécuter le handler
    const result = await routeHandler(bodyData);
    
    return res.json({
      ...result,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error('❌ DeepSeek AI Error:', err);
    
    return res.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }, 500);
    
  } finally {
    // Fermer la connexion MongoDB
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (e) {
        error('Error closing MongoDB connection:', e);
      }
      mongoClient = null;
    }
  }
}
