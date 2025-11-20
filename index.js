// functions/matrice-api/src/index.js - FONCTION COMPLÈTE
import { MongoClient, ObjectId } from "mongodb";
import express from "express";

const app = express();
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// 🔹 CONNEXION MONGODB
let mongoClient = null;
const connectMongoDB = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGODB_URI non configurée");
  }
  
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("✅ Connecté à MongoDB Atlas");
  }
  
  return mongoClient.db(DB_NAME);
};

// 🔹 FONCTION DE NETTOYAGE DES DONNÉES
const cleanArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(item => item && item !== '');
  if (typeof data === 'string') return data.split(',').map(item => item.trim()).filter(item => item);
  return [String(data)].filter(item => item && item !== '');
};

const cleanData = (rawData, collectionType) => {
  const cleaned = { ...rawData };
  
  // Nettoyer selon le type de collection
  switch (collectionType) {
    case 'members':
      cleaned.specialties = cleanArray(cleaned.specialties);
      cleaned.skills = cleanArray(cleaned.skills);
      cleaned.projects = cleanArray(cleaned.projects);
      break;
      
    case 'projects':
    case 'groups':
      cleaned.tags = cleanArray(cleaned.tags);
      cleaned.members = cleanArray(cleaned.members);
      break;
      
    case 'analyses':
      if (cleaned.insights && typeof cleaned.insights === 'string') {
        try {
          cleaned.insights = JSON.parse(cleaned.insights);
        } catch (e) {
          cleaned.insights = {};
        }
      }
      cleaned.suggestions = cleanArray(cleaned.suggestions);
      break;
      
    case 'interactions':
      cleaned.to = cleanArray(cleaned.to);
      cleaned.projects = cleanArray(cleaned.projects);
      break;
  }
  
  return cleaned;
};

// 🔹 ROUTES API

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: "OK",
    message: "API Matrice opérationnelle",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});

// Test synchronisation MongoDB
app.get('/api/v1/test-mongodb-sync', async (req, res) => {
  try {
    const db = await connectMongoDB();
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    res.json({
      success: true,
      message: "Connexion MongoDB établie",
      connected: true,
      database: DB_NAME,
      collections: collectionNames,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur connexion MongoDB",
      error: error.message
    });
  }
});

// Synchronisation universelle MongoDB
app.post('/api/v1/sync-mongodb', async (req, res) => {
  const { collection, data, operation = 'create', id = null, filter = {}, bulkData = [] } = req.body;
  
  const validCollections = ['members', 'projects', 'groups', 'analyses', 'interactions', 'skills', 'specialties'];
  
  if (!collection || !validCollections.includes(collection)) {
    return res.status(400).json({
      success: false,
      message: `Collection invalide: ${collection}. Valides: ${validCollections.join(', ')}`
    });
  }

  try {
    const db = await connectMongoDB();
    const collectionObj = db.collection(collection);

    let result;
    let mongoId;

    switch (operation) {
      case 'create':
        const dataToInsert = cleanData(data, collection);
        dataToInsert.createdAt = new Date();
        dataToInsert.updatedAt = new Date();
        
        result = await collectionObj.insertOne(dataToInsert);
        mongoId = result.insertedId;
        break;

      case 'update':
        if (!id) {
          return res.status(400).json({
            success: false,
            message: "ID requis pour la mise à jour"
          });
        }

        const updateData = cleanData(data, collection);
        updateData.updatedAt = new Date();
        
        result = await collectionObj.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        mongoId = id;
        break;

      case 'delete':
        if (!id) {
          return res.status(400).json({
            success: false,
            message: "ID requis pour la suppression"
          });
        }

        result = await collectionObj.deleteOne({ _id: new ObjectId(id) });
        break;

      case 'bulk':
        if (!bulkData.length) {
          return res.status(400).json({
            success: false,
            message: "Données bulk manquantes"
          });
        }

        const bulkOps = bulkData.map(item => ({
          updateOne: {
            filter: { _id: new ObjectId(item.id) },
            update: { 
              $set: { 
                ...cleanData(item.data, collection),
                updatedAt: new Date() 
              },
              $setOnInsert: { createdAt: new Date() }
            },
            upsert: true
          }
        }));
        
        result = await collectionObj.bulkWrite(bulkOps);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: `Opération non supportée: ${operation}`
        });
    }

    res.json({
      success: true,
      operation,
      collection,
      mongoId: mongoId?.toString(),
      result: {
        insertedId: result.insertedId?.toString(),
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount,
        upsertedCount: result.upsertedCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Erreur synchronisation ${collection}:`, error);
    res.status(500).json({
      success: false,
      operation,
      collection,
      message: `Erreur synchronisation: ${error.message}`
    });
  }
});

// Récupération de toutes les données de la matrice
app.get('/api/v1/all-data/matrix-data', async (req, res) => {
  try {
    const db = await connectMongoDB();
