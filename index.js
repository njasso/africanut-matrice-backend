// functions/sync-to-mongodb/src/index.js - FONCTION UNIVERSELLE
import { MongoClient, ObjectId } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Synchronisation universelle vers MongoDB Atlas - TOUTES LES COLLECTIONS");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    error("❌ Variable MONGODB_URI manquante !");
    return res.json({ 
      success: false, 
      message: "Configuration MongoDB manquante" 
    });
  }

  // Vérifier que nous avons des données
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.json({
      success: false,
      message: "Aucune donnée à synchroniser"
    });
  }

  const { 
    collection, // 'members', 'projects', 'groups', 'analyses', 'interactions', 'skills', 'specialties'
    data, 
    operation = 'create', // 'create', 'update', 'delete', 'upsert', 'bulk'
    id = null,
    filter = {},
    bulkData = []
  } = req.body;
  
  const validCollections = ['members', 'projects', 'groups', 'analyses', 'interactions', 'skills', 'specialties'];
  
  if (!collection || !validCollections.includes(collection)) {
    return res.json({
      success: false,
      message: `Collection invalide. Doit être: ${validCollections.join(', ')}`
    });
  }

  if (!data && operation !== 'delete' && operation !== 'bulk') {
    return res.json({
      success: false,
      message: "Données manquantes"
    });
  }

  log(`📝 Opération: ${operation} - Collection: ${collection}`);
  if (data) {
    log("📦 Données reçues:", JSON.stringify(data).substring(0, 200) + "...");
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    const collectionObj = db.collection(collection);

    let result;
    let mongoId;

    // 🔹 FONCTION DE NETTOYAGE DES DONNÉES SPÉCIFIQUE À CHAQUE COLLECTION
    const cleanData = (rawData, collectionType) => {
      const cleaned = { ...rawData };
      
      // Retirer les champs système AppWrite si présents
      delete cleaned.$id;
      delete cleaned.$collectionId;
      delete cleaned.$databaseId;
      delete cleaned.$permissions;
      delete cleaned.$createdAt;
      delete cleaned.$updatedAt;
      
      // Nettoyer selon le type de collection
      switch (collectionType) {
        case 'members':
          // Nettoyer les tableaux de compétences et spécialités
          cleaned.specialties = cleanArray(cleaned.specialties, 'specialties');
          cleaned.skills = cleanArray(cleaned.skills, 'skills');
          cleaned.projects = cleanArray(cleaned.projects, 'projects');
          
          // Corriger les URLs de photos
          if (cleaned.photo && cleaned.photo.startsWith('../assets/photos/')) {
            cleaned.photo = cleaned.photo.replace('../assets/photos/', '/assets/photos/');
          }
          
          // Assurer les champs requis
          cleaned.name = cleaned.name || '';
          cleaned.email = cleaned.email || '';
          cleaned.statutMembre = cleaned.statutMembre || 'Actif';
          cleaned.isActive = cleaned.isActive !== undefined ? cleaned.isActive : true;
          break;
          
        case 'projects':
          // Nettoyer les tags et membres
          cleaned.tags = cleanArray(cleaned.tags, 'tags');
          cleaned.members = cleanArray(cleaned.members, 'members');
          
          // Assurer les champs requis
          cleaned.title = cleaned.title || 'Sans titre';
          cleaned.description = cleaned.description || '';
          cleaned.status = cleaned.status || 'idea';
          cleaned.organization = cleaned.organization || '';
          break;
          
        case 'groups':
          // Nettoyer les tags et membres
          cleaned.tags = cleanArray(cleaned.tags, 'tags');
          cleaned.members = cleanArray(cleaned.members, 'members');
          
          // Assurer les champs requis
          cleaned.name = cleaned.name || '';
          cleaned.description = cleaned.description || '';
          cleaned.type = cleaned.type || 'technique';
          cleaned.privacy = cleaned.privacy || 'public';
          break;
          
        case 'analyses':
          // S'assurer que les insights et suggestions sont valides
          if (cleaned.insights && typeof cleaned.insights === 'string') {
            try {
              cleaned.insights = JSON.parse(cleaned.insights);
            } catch (e) {
              cleaned.insights = {};
            }
          }
          cleaned.insights = cleaned.insights || {};
          
          cleaned.suggestions = cleanArray(cleaned.suggestions, 'suggestions');
          cleaned.statistics = cleaned.statistics || {};
          
          // Assurer les champs requis
          cleaned.type = cleaned.type || 'interaction_analysis';
          cleaned.title = cleaned.title || '';
          cleaned.status = cleaned.status || 'completed';
          break;
          
        case 'interactions':
          // Nettoyer les tableaux de destinataires et projets
          cleaned.to = cleanArray(cleaned.to, 'to');
          cleaned.projects = cleanArray(cleaned.projects, 'projects');
          
          // Assurer les champs requis
          cleaned.type = cleaned.type || 'message';
          cleaned.title = cleaned.title || '';
          cleaned.description = cleaned.description || '';
          cleaned.status = cleaned.status || 'pending';
          break;
          
        case 'skills':
          // Nettoyer les données de compétences
          cleaned.name = cleaned.name || '';
          cleaned.category = cleaned.category || 'technique';
          cleaned.description = cleaned.description || '';
          cleaned.memberCount = cleaned.memberCount || 0;
          break;
          
        case 'specialties':
          // Nettoyer les données de spécialités
          cleaned.name = cleaned.name || '';
          cleaned.category = cleaned.category || 'technique';
          cleaned.description = cleaned.description || '';
          cleaned.memberCount = cleaned.memberCount || 0;
          break;
      }
      
      // Ajouter les timestamps
      if (operation === 'create') {
        cleaned.createdAt = new Date();
        cleaned.updatedAt = new Date();
      } else if (operation === 'update') {
        cleaned.updatedAt = new Date();
        // Ne pas écraser createdAt lors des updates
        delete cleaned.createdAt;
      }
      
      return cleaned;
    };

    // 🔹 FONCTION POUR NETTOYER LES TABLEAUX
    const cleanArray = (data, fieldName = '') => {
      if (!data) return [];
      
      if (Array.isArray(data)) {
        return data
          .map(item => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
              // Gérer les ObjectId et les objets avec _id
              if (item._id) return item._id.toString();
              if (item.$id) return item.$id;
              if (item.name) return item.name.trim();
              if (item.toString) return item.toString();
            }
            return String(item).trim();
          })
          .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
      }
      
      if (typeof data === 'string') {
        return data
          .split(/[,;|]/)
          .map(item => item.trim())
          .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
      }
      
      return [String(data).trim()].filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
    };

    // 🔹 EXÉCUTION DES OPÉRATIONS
    switch (operation) {
      case 'create':
        const dataToInsert = cleanData(data, collection);
        result = await collectionObj.insertOne(dataToInsert);
        mongoId = result.insertedId;
        log(`✅ Document créé dans ${collection} - ID: ${mongoId}`);
        break;

      case 'update':
        if (!id) {
          throw new Error("ID du document requis pour la mise à jour");
        }

        const updateData = cleanData(data, collection);
        result = await collectionObj.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        mongoId = id;
        log(`✅ Document mis à jour dans ${collection} - ID: ${id} - Modifications: ${result.modifiedCount}`);
        break;

      case 'upsert':
        const upsertData = cleanData(data, collection);
        const upsertFilter = id ? { _id: new ObjectId(id) } : filter;
        
        if (Object.keys(upsertFilter).length === 0) {
          // Si pas de filtre, utiliser un identifiant unique selon la collection
          const uniqueField = getUniqueField(collection, upsertData);
          if (uniqueField) {
            upsertFilter[uniqueField] = upsertData[uniqueField];
          }
        }

        if (Object.keys(upsertFilter).length === 0) {
          throw new Error("Impossible de déterminer le filtre pour l'upsert");
        }

        result = await collectionObj.updateOne(
          upsertFilter,
          { 
            $set: { ...upsertData, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );

        mongoId = result.upsertedId || id;
        log(`✅ Upsert dans ${collection} - ID: ${mongoId} - Created: ${!!result.upsertedId}`);
        break;

      case 'delete':
        if (!id && Object.keys(filter).length === 0) {
          throw new Error("ID ou filtre requis pour la suppression");
        }

        const deleteFilter = id ? { _id: new ObjectId(id) } : filter;
        result = await collectionObj.deleteOne(deleteFilter);
        log(`✅ Document supprimé de ${collection} - Suppressions: ${result.deletedCount}`);
        break;

      case 'bulk':
        if (!bulkData || !Array.isArray(bulkData) || bulkData.length === 0) {
          throw new Error("Données bulk manquantes ou invalides");
        }

        const bulkOperations = bulkData.map(item => {
          const cleanedItem = cleanData(item.data || item, collection);
          const itemFilter = item.id ? { _id: new ObjectId(item.id) } : item.filter || {};
          
          if (Object.keys(itemFilter).length === 0) {
            const uniqueField = getUniqueField(collection, cleanedItem);
            if (uniqueField) {
              itemFilter[uniqueField] = cleanedItem[uniqueField];
            }
          }

          return {
            updateOne: {
              filter: itemFilter,
              update: { 
                $set: { ...cleanedItem, updatedAt: new Date() },
                $setOnInsert: { createdAt: new Date() }
              },
              upsert: true
            }
          };
        });

        result = await collectionObj.bulkWrite(bulkOperations);
        log(`✅ Bulk operation dans ${collection} - Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);
        break;

      default:
        throw new Error(`Opération non supportée: ${operation}`);
    }

    await client.close();

    return res.json({
      success: true,
      operation,
      collection,
      mongoId: mongoId?.toString(),
      result: {
        insertedId: result.insertedId?.toString(),
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount,
        upsertedCount: result.upsertedCount,
        upsertedId: result.upsertedId?.toString()
      },
      timestamp: new Date().toISOString(),
      message: `Opération ${operation} réussie sur la collection ${collection}`
    });

  } catch (err) {
    error(`❌ Erreur synchronisation ${collection}: ${err.message}`);
    if (client) await client.close();
    
    return res.json({ 
      success: false, 
      operation,
      collection,
      message: `Erreur lors de la synchronisation ${collection}: ${err.message}`,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

// 🔹 FONCTION POUR DÉTERMINER LE CHAMP UNIQUE PAR COLLECTION
function getUniqueField(collection, data) {
  const uniqueFields = {
    'members': 'email',
    'projects': 'title', 
    'groups': 'name',
    'analyses': 'title',
    'interactions': 'title',
    'skills': 'name',
    'specialties': 'name'
  };
  
  const field = uniqueFields[collection];
  return field && data[field] ? field : null;
}
