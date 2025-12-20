// functions/deepseek-ai/src/index.js - VERSION FINALE COMBINÉE
export default async function handler({ req, res, log, error }) {
  log(`🤖 DeepSeek AI Handler - ${req.method} ${req.path || '/'}`);
  
  try {
    // Parse la requête
    const { method, body } = req;
    
    let requestData = {};
    if (body) {
      try {
        requestData = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {
        log('⚠️ Erreur parsing JSON');
        return res.json({
          success: false,
          error: 'Invalid JSON format',
          timestamp: new Date().toISOString()
        }, 400);
      }
    }
    
    // Log des données reçues
    log('📥 Request data:', {
      action: requestData.action,
      dataKeys: Object.keys(requestData)
    });
    
    // Route GET par défaut
    if (method === 'GET') {
      return res.json({
        success: true,
        service: 'DeepSeek AI Integration',
        version: '4.0.0',
        status: 'active',
        endpoints: [
          'POST - test_connection',
          'POST - analyze_synergy',
          'POST - recommend_team',
          'POST - chat'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    // POST requests
    if (method === 'POST') {
      const { action, ...data } = requestData;
      
      if (!action) {
        return res.json({
          success: false,
          error: 'Action is required',
          available: ['test_connection', 'analyze_synergy', 'recommend_team', 'chat'],
          timestamp: new Date().toISOString()
        }, 400);
      }
      
      log(`🎯 Action: ${action}`);
      
      switch (action) {
        case 'test_connection':
          return await handleTestConnection(res, log);
          
        case 'analyze_synergy':
          return await handleAnalyzeSynergy(data, res, log, error);
          
        case 'recommend_team':
          return await handleRecommendTeam(data, res, log);
          
        case 'chat':
          return await handleChat(data, res, log);
          
        default:
          return res.json({
            success: false,
            error: `Unknown action: ${action}`,
            timestamp: new Date().toISOString()
          }, 404);
      }
    }
    
    // Méthode non supportée
    return res.json({
      success: false,
      error: `Method ${method} not supported`,
      timestamp: new Date().toISOString()
    }, 405);
    
  } catch (err) {
    error('❌ Handler error:', err);
    return res.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

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
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  
  if (!DEEPSEEK_API_KEY) {
    return {
      success: false,
      error: 'DeepSeek API key not configured',
      mock: true,
      choices: [{
        message: {
          content: `🧠 **ANALYSE DE SYNERGIE** (Mode Simulation)

🔍 **SCORE DE COMPLÉMENTARITÉ: 8/10**
Cette combinaison présente une excellente complémentarité technique.

🎯 **DOMAINES STRATÉGIQUES:**
1. Innovation technologique
2. Gestion de projets complexes
3. Développement durable

📅 **ACTIONS RECOMMANDÉES:**
1. Session de brainstorming collaborative
2. Projet pilote sur 4-6 semaines
3. Mentorat croisé

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
        max_tokens: options.max_tokens || 1200,
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
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Timeout after 25 seconds');
    }
    throw err;
  }
}

// ========== HANDLERS ==========

async function handleTestConnection(res, log) {
  log('🧪 Test connexion DeepSeek');
  
  try {
    const response = await callDeepSeekAPI([
      { role: 'user', content: 'Test de connexion. Réponds uniquement par "Connected" si fonctionnel.' }
    ], { max_tokens: 10 });

    const isApiKeyConfigured = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length > 20;
    
    return res.json({
      success: true,
      data: {
        status: isApiKeyConfigured ? 'connected' : 'connected_mock',
        response: response.choices?.[0]?.message?.content || 'OK',
        model: response.model,
        mock: response.mock || !isApiKeyConfigured,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    log('❌ Test connection error:', err.message);
    return res.json({
      success: true,
      data: {
        status: 'connected_mock',
        error: err.message,
        mock: true,
        timestamp: new Date().toISOString()
      }
    });
  }
}

async function handleAnalyzeSynergy(data, res, log, errorLog) {
  const { member1, member2, projectId, context } = data;
  
  log('🔍 Analyse synergie demandée:', {
    m1: member1?.name || member1?._id,
    m2: member2?.name || member2?._id,
    projectId
  });

  let db = null;
  try {
    // Connexion à MongoDB si URI disponible
    if (MONGODB_URI) {
      try {
        const mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        db = mongoClient.db(MONGODB_DB_NAME);
        log('✅ MongoDB connecté');
      } catch (mongoError) {
        log('⚠️ MongoDB non disponible:', mongoError.message);
      }
    }

    // Récupérer les données membres
    let member1Data = typeof member1 === 'object' ? member1 : null;
    let member2Data = typeof member2 === 'object' ? member2 : null;

    if (db) {
      const { MongoClient, ObjectId } = await import('mongodb');
      
      if (!member1Data && member1) {
        try {
          member1Data = await db.collection('members').findOne({ 
            _id: typeof member1 === 'string' ? new ObjectId(member1) : new ObjectId(member1._id || member1.id)
          });
        } catch (e) {
          log('⚠️ Erreur récupération membre 1:', e.message);
        }
      }
      
      if (!member2Data && member2) {
        try {
          member2Data = await db.collection('members').findOne({ 
            _id: typeof member2 === 'string' ? new ObjectId(member2) : new ObjectId(member2._id || member2.id)
          });
        } catch (e) {
          log('⚠️ Erreur récupération membre 2:', e.message);
        }
      }
    }

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
    const isMock = response.mock || false;

    // Sauvegarder l'analyse si MongoDB est disponible
    let analysisId = null;
    if (db && member1Data && member2Data) {
      try {
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
            confidence: isMock ? 0.7 : 0.85
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await db.collection('analyses').insertOne(analysisRecord);
        analysisId = result.insertedId.toString();
        log('✅ Analyse sauvegardée dans MongoDB');
      } catch (saveError) {
        log('⚠️ Erreur sauvegarde analyse:', saveError.message);
      }
    }

    return res.json({
      success: true,
      data: {
        analysis,
        analysisId: analysisId || `analysis_${Date.now()}_${isMock ? 'mock' : 'ai'}`,
        members: {
          member1: {
            _id: member1Data?._id || member1,
            id: member1Data?._id || member1,
            name: member1Data?.name || 'Expert 1'
          },
          member2: {
            _id: member2Data?._id || member2,
            id: member2Data?._id || member2,
            name: member2Data?.name || 'Expert 2'
          }
        },
        metadata: {
          model: response.model,
          mock: isMock,
          confidence: isMock ? 0.7 : 0.85,
          timestamp: new Date().toISOString(),
          api_key_configured: !!process.env.DEEPSEEK_API_KEY
        }
      }
    });

  } catch (err) {
    errorLog('❌ Erreur analyse synergie:', err);
    
    // Fallback
    return res.json({
      success: true,
      data: {
        analysis: `🔍 **ANALYSE DE SYNERGIE** (Mode Fallback)\n\nEntre ${data.member1?.name || 'Membre 1'} et ${data.member2?.name || 'Membre 2'}\n\n**Potentiel estimé:** Bonne complémentarité\n**Score:** 6-7/10\n**Recommandation:** Collaboration recommandée pour maximiser les compétences complémentaires.`,
        analysisId: `fallback_${Date.now()}`,
        members: {
          member1: { 
            _id: data.member1?._id || 'unknown', 
            id: data.member1?._id || 'unknown', 
            name: data.member1?.name || 'Expert 1' 
          },
          member2: { 
            _id: data.member2?._id || 'unknown', 
            id: data.member2?._id || 'unknown', 
            name: data.member2?.name || 'Expert 2' 
          }
        },
        metadata: {
          model: 'fallback',
          mock: true,
          confidence: 0.6,
          error: err.message,
          timestamp: new Date().toISOString()
        }
      }
    });
  } finally {
    // Fermer la connexion MongoDB
    if (mongoClient) {
      try {
        await mongoClient.close();
        mongoClient = null;
      } catch (closeError) {
        log('⚠️ Erreur fermeture MongoDB:', closeError.message);
      }
    }
  }
}

async function handleRecommendTeam(data, res, log) {
  log('👥 Recommandation équipe:', data);
  
  try {
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

    return res.json({
      success: true,
      data: {
        recommendations: response.choices?.[0]?.message?.content || 'Recommandations non disponibles',
        metadata: { 
          model: response.model,
          mock: response.mock || false,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    log('❌ Recommend team error:', err.message);
    return res.json({
      success: true,
      data: {
        recommendations: 'Recommandations en mode simulation',
        metadata: {
          model: 'deepseek-chat_mock',
          mock: true,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}

async function handleChat(data, res, log) {
  log('💬 Chat demandé:', { messagesCount: data.messages?.length || 0 });
  
  try {
    const response = await callDeepSeekAPI(data.messages || [], {
      model: data.model || 'deepseek-chat',
      temperature: data.temperature || 0.7
    });

    return res.json({
      success: true,
      data: {
        response: response.choices?.[0]?.message?.content || 'Réponse non disponible',
        metadata: { 
          model: response.model,
          mock: response.mock || false,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    log('❌ Chat error:', err.message);
    return res.json({
      success: true,
      data: {
        response: "Assistant IA en mode simulation",
        metadata: {
          model: 'deepseek-chat_mock',
          mock: true,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}
