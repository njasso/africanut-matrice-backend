import { MongoClient, ObjectId } from 'mongodb';

// ========== CONFIGURATION ==========
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "matrice";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Cache pour MongoDB
let mongoClient = null;

async function getDatabase() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db(MONGODB_DB_NAME);
}

// ========== DEEPSEEK API ==========
async function callDeepSeekAPI(messages, options = {}) {
  if (!DEEPSEEK_API_KEY) {
    return {
      success: false,
      error: 'DeepSeek API key not configured',
      mock: true,
      choices: [{
        message: {
          content: `Mode simulation - Configurez DEEPSEEK_API_KEY pour activer l'IA réelle.

🔍 **ANALYSE DE SYNERGIE** (Mode Simulation)
Entre les membres spécifiés.

**Score estimé:** 7/10
**Potentiel:** Bonne complémentarité
**Recommandation:** Collaboration recommandée

⚠️ **Pour activer l'IA réelle:** Ajoutez votre clé API DeepSeek dans les variables d'environnement.`
        }
      }],
      model: 'deepseek-chat_mock',
      usage: { total_tokens: 150 }
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
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
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout after 25 seconds');
    }
    throw error;
  }
}

// ========== HANDLERS ==========

// Test de connexion
async function testConnection() {
  try {
    const response = await callDeepSeekAPI([
      { role: 'user', content: 'Test de connexion. Réponds uniquement par "Connected" si fonctionnel.' }
    ], { max_tokens: 10 });

    return {
      status: 'connected',
      response: response.choices?.[0]?.message?.content || 'OK',
      model: response.model,
      mock: response.mock || false,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      mock: true,
      timestamp: new Date().toISOString()
    };
  }
}

// Analyse de synergie - Version compatible avec votre frontend
async function analyzeSynergy(data) {
  const { member1, member2, projectId, context } = data;
  
  console.log('🔍 Analyse synergie demandée:', {
    member1: member1?.name,
    member2: member2?.name,
    projectId
  });

  let db;
  try {
    if (MONGODB_URI) {
      db = await getDatabase();
    }

    // Préparer les données membres
    const member1Data = typeof member1 === 'object' ? member1 : 
                       (db ? await db.collection('members').findOne({ _id: new ObjectId(member1) }) : null);
    
    const member2Data = typeof member2 === 'object' ? member2 :
                       (db ? await db.collection('members').findOne({ _id: new ObjectId(member2) }) : null);

    const projectData = projectId && db ? 
                       await db.collection('projects').findOne({ _id: new ObjectId(projectId) }) : null;

    // Construire le prompt
    const prompt = `
      Analyse de synergie professionnelle - Format structuré

      CONTEXTE: ${context || 'Optimisation des collaborations professionnelles'}

      ${member1Data ? `
      PROFIL 1:
      - Nom: ${member1Data.name || 'Non spécifié'}
      - Poste: ${member1Data.title || 'Non spécifié'}
      - Compétences: ${Array.isArray(member1Data.skills) ? member1Data.skills.join(', ') : 'Non spécifié'}
      - Spécialités: ${Array.isArray(member1Data.specialties) ? member1Data.specialties.join(', ') : 'Non spécifié'}
      - Organisation: ${member1Data.organization || 'Non spécifiée'}
      ` : 'Membre 1: Données non disponibles'}

      ${member2Data ? `
      PROFIL 2:
      - Nom: ${member2Data.name || 'Non spécifié'}
      - Poste: ${member2Data.title || 'Non spécifié'}
      - Compétences: ${Array.isArray(member2Data.skills) ? member2Data.skills.join(', ') : 'Non spécifié'}
      - Spécialités: ${Array.isArray(member2Data.specialties) ? member2Data.specialties.join(', ') : 'Non spécifié'}
      - Organisation: ${member2Data.organization || 'Non spécifiée'}
      ` : 'Membre 2: Données non disponibles'}

      ${projectData ? `
      CONTEXTE PROJET:
      - Titre: ${projectData.title || 'Non spécifié'}
      - Description: ${projectData.description || 'Non spécifiée'}
      ` : ''}

      ANALYSE REQUISE:
      Fournis une analyse détaillée avec les sections:

      1. SCORE DE COMPLÉMENTARITÉ (1-10)
      • Justification du score
      • Points forts de cette combinaison

      2. DOMAINES STRATÉGIQUES
      • Domaines où cette synergie est la plus prometteuse

      3. ACTIONS RECOMMANDÉES (4-6 actions concrètes)
      • Court terme (1-3 mois)
      • Moyen terme (3-6 mois)

      4. IMPACT POTENTIEL
      • Sur l'innovation
      • Sur la productivité
      • Sur le développement organisationnel

      5. FACTEURS DE RISQUE
      • Points de vigilance
      • Atténuation recommandée

      Ton: Professionnel, factuel, orienté action. Maximum 500 mots.
    `;

    // Appel DeepSeek
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: `Tu es un expert en optimisation des ressources humaines et gestion des talents.
                  Tu analyses les synergies avec précision et fournis des recommandations pratiques.
                  Réponds toujours en français de manière structurée.`
      },
      { role: 'user', content: prompt }
    ]);

    const analysis = response.choices?.[0]?.message?.content || 'Analyse non disponible';

    // Sauvegarder l'analyse si MongoDB est disponible
    let analysisId = null;
    if (db && member1Data && member2Data) {
      const analysisRecord = {
        type: 'ai_synergy_analysis',
        title: `Synergie: ${member1Data.name} & ${member2Data.name}`,
        members: [member1Data._id, member2Data._id],
        project: projectId,
        analysis,
        metadata: {
          model: response.model,
          tokens: response.usage?.total_tokens || 0,
          context,
          confidence: 0.85
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('analyses').insertOne(analysisRecord);
      analysisId = result.insertedId.toString();
    }

    return {
      success: true,
      analysis,
      analysisId: analysisId || `mock_${Date.now()}`,
      members: {
        member1: {
          id: member1Data?._id || member1,
          name: member1Data?.name || 'Membre 1'
        },
        member2: {
          id: member2Data?._id || member2,
          name: member2Data?.name || 'Membre 2'
        }
      },
      metadata: {
        model: response.model,
        mock: response.mock || false,
        confidence: response.mock ? 0.7 : 0.85,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('❌ Erreur analyse synergie:', error);
    
    // Fallback avec analyse de base
    return {
      success: true,
      analysis: `🔍 **ANALYSE DE SYNERGIE** (Mode Fallback)\n\nEntre ${data.member1?.name || 'Membre 1'} et ${data.member2?.name || 'Membre 2'}\n\n**Potentiel estimé:** Bonne complémentarité\n**Score:** 6-7/10\n**Recommandation:** Collaboration recommandée pour maximiser les compétences complémentaires.`,
      analysisId: `fallback_${Date.now()}`,
      members: {
        member1: { id: data.member1?._id || 'unknown', name: data.member1?.name || 'Membre 1' },
        member2: { id: data.member2?._id || 'unknown', name: data.member2?.name || 'Membre 2' }
      },
      metadata: {
        model: 'fallback',
        mock: true,
        confidence: 0.6,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    };
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
    }
  }
}

// ========== ROUTER SIMPLIFIÉ ==========
const routes = {
  'test_connection': testConnection,
  'analyze_synergy': analyzeSynergy,
  
  'recommend_team': async (data) => {
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: 'Expert en composition d\'équipes'
      },
      { 
        role: 'user', 
        content: `Recommandation d'équipe pour projet: ${data.projectId || 'Général'}. Taille: ${data.teamSize || 4} personnes.`
      }
    ]);

    return {
      success: true,
      recommendations: response.choices?.[0]?.message?.content,
      metadata: { model: response.model }
    };
  },

  'chat': async (data) => {
    const response = await callDeepSeekAPI(data.messages || [], {
      model: data.model,
      temperature: data.temperature
    });

    return {
      success: true,
      response: response.choices?.[0]?.message?.content,
      metadata: { model: response.model }
    };
  }
};

// ========== HANDLER PRINCIPAL ==========
export default async function handler({ req, res, log, error }) {
  log(`🤖 DeepSeek AI Handler - ${req.method} ${req.path || '/'}`);

  try {
    const { method, path, body } = req;
    
    // Parse body
    let requestData = {};
    if (body) {
      try {
        requestData = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {
        return res.json({ 
          success: false, 
          error: 'Invalid JSON body' 
        }, 400);
      }
    }

    // Route par défaut
    if (method === 'GET' && (!path || path === '/')) {
      return res.json({
        success: true,
        service: 'DeepSeek AI Integration',
        version: '1.0.0',
        endpoints: [
          'POST / - Analyse synergie (action: analyze_synergy)',
          'POST / - Test (action: test_connection)',
          'POST / - Recommandation équipe (action: recommend_team)',
          'POST / - Chat (action: chat)'
        ]
      });
    }

    // POST requests
    if (method === 'POST') {
      const { action, ...data } = requestData;
      
      if (!action) {
        return res.json({ 
          success: false, 
          error: 'Action required. Available: test_connection, analyze_synergy, recommend_team, chat' 
        }, 400);
      }

      const handler = routes[action];
      if (!handler) {
        return res.json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, 404);
      }

      const result = await handler(data);
      return res.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString()
      });
    }

    // Méthode non supportée
    return res.json({ 
      success: false, 
      error: `Method ${method} not supported` 
    }, 405);

  } catch (err) {
    error('❌ DeepSeek handler error:', err);
    return res.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}
