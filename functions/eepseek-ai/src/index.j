import { MongoClient, ObjectId } from 'mongodb';

// Cache MongoDB
let mongoClient = null;
let db = null;

async function getDatabase() {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(process.env.MONGODB_DB_NAME || "matrice");
  }
  return db;
}

// Fonction pour appeler DeepSeek API
async function callDeepSeekAPI(messages, options = {}) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY non configurée');
  }

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
    timeout: 30000
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `API Error: ${response.status}`);
  }

  return await response.json();
}

// ========== SERVICES AI ==========

// 1. Analyse de synergie entre membres
async function analyzeSynergy(member1Id, member2Id, projectId = null) {
  const db = await getDatabase();
  
  // Récupérer les données depuis MongoDB
  const [member1, member2, project] = await Promise.all([
    db.collection('members').findOne({ _id: new ObjectId(member1Id) }),
    db.collection('members').findOne({ _id: new ObjectId(member2Id) }),
    projectId ? db.collection('projects').findOne({ _id: new ObjectId(projectId) }) : Promise.resolve(null)
  ]);

  if (!member1 || !member2) {
    throw new Error('Membre(s) non trouvé(s)');
  }

  const prompt = `
    Analyse la synergie professionnelle entre deux collaborateurs pour un projet.
    
    MEMBRE 1: ${member1.name}
    Compétences: ${Array.isArray(member1.skills) ? member1.skills.join(', ') : 'Non spécifié'}
    Spécialités: ${Array.isArray(member1.specialties) ? member1.specialties.join(', ') : 'Non spécifié'}
    ${member1.title ? `Poste: ${member1.title}` : ''}
    ${member1.experienceYears ? `Expérience: ${member1.experienceYears} ans` : ''}
    
    MEMBRE 2: ${member2.name}
    Compétences: ${Array.isArray(member2.skills) ? member2.skills.join(', ') : 'Non spécifié'}
    Spécialités: ${Array.isArray(member2.specialties) ? member2.specialties.join(', ') : 'Non spécifié'}
    ${member2.title ? `Poste: ${member2.title}` : ''}
    ${member2.experienceYears ? `Expérience: ${member2.experienceYears} ans` : ''}
    
    ${project ? `
    PROJET: ${project.title || 'Sans titre'}
    Description: ${project.description || 'Non spécifiée'}
    ` : 'Contexte: Collaboration générale'}
    
    Fournis une analyse structurée en français avec:
    1. Score de complémentarité (1-10) avec justification
    2. Forces de cette combinaison
    3. Risques ou points d'attention
    4. 3 recommandations concrètes pour maximiser la collaboration
    
    Sois professionnel, concis et pratique.
  `;

  const response = await callDeepSeekAPI([
    {
      role: 'system',
      content: 'Tu es un expert en ressources humaines et optimisation d\'équipes. Tu analyses les synergies professionnelles avec précision et pragmatisme.'
    },
    { role: 'user', content: prompt }
  ]);

  const analysis = response.choices[0]?.message?.content;

  // Sauvegarder l'analyse dans MongoDB
  const analysisRecord = {
    type: 'member_synergy_analysis',
    title: `Synergie ${member1.name} & ${member2.name}`,
    member1: member1Id,
    member2: member2Id,
    project: projectId,
    analysis,
    aiModel: 'deepseek-chat',
    synergyScore: extractSynergyScore(analysis), // Fonction à implémenter
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('synergy_analyses').insertOne(analysisRecord);

  return {
    success: true,
    analysis,
    analysisId: result.insertedId.toString(),
    members: {
      member1: { name: member1.name, id: member1Id },
      member2: { name: member2.name, id: member2Id }
    },
    project: project ? { title: project.title, id: projectId } : null
  };
}

// 2. Recommandations d'équipe pour un projet
async function recommendTeamForProject(projectId, options = {}) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  if (!project) {
    throw new Error('Projet non trouvé');
  }

  // Récupérer tous les membres disponibles
  const allMembers = await db.collection('members')
    .find({ isActive: true })
    .project({ name: 1, skills: 1, specialties: 1, title: 1, experienceYears: 1 })
    .toArray();

  const prompt = `
    Recommande la composition d'une équipe optimale pour ce projet.
    
    PROJET: ${project.title}
    Description: ${project.description || 'Non spécifiée'}
    
    Membres disponibles (${allMembers.length}):
    ${allMembers.map((m, i) => `
      ${i+1}. ${m.name}
      - Poste: ${m.title || 'Non spécifié'}
      - Compétences: ${Array.isArray(m.skills) ? m.skills.slice(0, 5).join(', ') : 'Non spécifié'}
      - Spécialités: ${Array.isArray(m.specialties) ? m.specialties.slice(0, 3).join(', ') : 'Non spécifié'}
      ${m.experienceYears ? `- Expérience: ${m.experienceYears} ans` : ''}
    `).join('\n')}
    
    Contraintes:
    - Taille équipe recommandée: ${options.teamSize || 3-5} personnes
    - Compétences requises: ${Array.isArray(project.tags) ? project.tags.join(', ') : 'Aucune spécifique'}
    
    Fournis:
    1. Proposition d'équipe idéale (noms + rôles)
    2. Justification pour chaque membre
    3. Complémentarité globale
    4. Points de vigilance
    
    Réponse en français, format structuré.
  `;

  const response = await callDeepSeekAPI([
    {
      role: 'system',
      content: 'Tu es un chef de projet expérimenté spécialisé dans la composition d\'équipes performantes.'
    },
    { role: 'user', content: prompt }
  ]);

  return {
    success: true,
    project: { title: project.title, id: projectId },
    recommendations: response.choices[0]?.message?.content,
    totalMembersConsidered: allMembers.length,
    timestamp: new Date().toISOString()
  };
}

// 3. Générer des descriptions de projet
async function generateProjectDescription(projectData) {
  const prompt = `
    Génère une description professionnelle pour un projet.
    
    Titre: ${projectData.title}
    Objectifs: ${projectData.objectives || 'Non spécifiés'}
    Technologies: ${Array.isArray(projectData.technologies) ? projectData.technologies.join(', ') : 'Non spécifiées'}
    Durée estimée: ${projectData.duration || 'Non spécifiée'}
    Budget: ${projectData.budget || 'Non spécifié'}
    
    Format souhaité:
    1. Présentation générale
    2. Objectifs principaux
    3. Technologies utilisées
    4. Livrables attendus
    5. Équipe recommandée
    6. Planning estimé
    
    Ton: Professionnel, motivant, clair.
  `;

  const response = await callDeepSeekAPI([
    {
      role: 'system',
      content: 'Tu es un consultant en gestion de projet et rédaction de documents professionnels.'
    },
    { role: 'user', content: prompt }
  ]);

  return {
    success: true,
    description: response.choices[0]?.message?.content,
    rawPrompt: prompt,
    timestamp: new Date().toISOString()
  };
}

// 4. Test de connexion à DeepSeek
async function testDeepSeekConnection() {
  try {
    const response = await callDeepSeekAPI([
      { role: 'user', content: 'Réponds par "OK" si tu es fonctionnel.' }
    ], {
      max_tokens: 10,
      temperature: 0.1
    });

    return {
      success: true,
      status: 'connected',
      response: response.choices[0]?.message?.content,
      model: response.model,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ========== ROUTEUR ==========

const router = {
  // Test de connexion
  'POST /test': testDeepSeekConnection,
  
  // Analyse de synergie
  'POST /synergy': async (body) => {
    const { member1, member2, project } = body;
    if (!member1 || !member2) {
      throw new Error('Les IDs des deux membres sont requis');
    }
    return await analyzeSynergy(member1, member2, project);
  },
  
  // Recommandations d'équipe
  'POST /team-recommendations': async (body) => {
    const { projectId, teamSize } = body;
    if (!projectId) {
      throw new Error('L\'ID du projet est requis');
    }
    return await recommendTeamForProject(projectId, { teamSize });
  },
  
  // Génération de descriptions
  'POST /generate-description': async (body) => {
    return await generateProjectDescription(body);
  },
  
  // Chat générique (pour d'autres usages)
  'POST /chat': async (body) => {
    const { messages, model, temperature, max_tokens } = body;
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Le champ messages est requis et doit être un tableau');
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
};

// ========== HANDLER PRINCIPAL ==========

export default async function handler({ req, res, log, error }) {
  log(`🤖 DeepSeek AI Function - ${req.method} ${req.path}`);
  
  try {
    const { method, path, body } = req;
    const bodyData = body ? JSON.parse(body) : {};
    
    // Trouver la route correspondante
    const routeKey = `${method} ${path}`;
    const routeHandler = router[routeKey];
    
    if (!routeHandler) {
      return res.json({
        success: false,
        error: 'Route non trouvée',
        availableRoutes: Object.keys(router)
      }, 404);
    }
    
    // Exécuter le handler
    const result = await routeHandler(bodyData);
    
    return res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    error('❌ Erreur DeepSeek AI:', err);
    
    return res.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }, 500);
  } finally {
    // Fermer la connexion MongoDB si elle existe
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      db = null;
    }
  }
}

// ========== UTILITAIRES ==========

function extractSynergyScore(analysis) {
  // Extraction simple d'un score dans le texte
  const scoreMatch = analysis.match(/Score.*?(\d+(?:\.\d+)?)\/10/) || 
                    analysis.match(/complémentarité.*?(\d+(?:\.\d+)?)/i);
  return scoreMatch ? parseFloat(scoreMatch[1]) : null;
}
