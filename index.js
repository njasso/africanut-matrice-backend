import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice - Récupération de toutes les collections");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGO_DB_NAME || "matrice";

  if (!MONGO_URI) {
    const msg = "❌ Variable MONGODB_URI manquante !";
    error(msg);
    return res.json({ 
      success: false, 
      message: msg,
      required: ['MONGODB_URI']
    });
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB Atlas - Base de données: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    
    // Liste toutes les collections disponibles
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    log(`📊 Collections trouvées: ${collectionNames.join(', ')}`);

    const allData = {};

    // Récupération de chaque collection
    for (const collectionName of collectionNames) {
      try {
        const documents = await db.collection(collectionName).find({}).toArray();
        
        // Conversion des ObjectId en string pour le JSON
        const formattedDocuments = documents.map(doc => ({
          ...doc,
          _id: doc._id?.toString()
        }));
        
        allData[collectionName] = formattedDocuments;
        log(`✅ Collection "${collectionName}" : ${formattedDocuments.length} documents`);
        
      } catch (colError) {
        error(`❌ Erreur sur la collection ${collectionName}: ${colError.message}`);
        allData[collectionName] = [];
      }
    }

    await client.close();
    log("🔒 Connexion MongoDB fermée");

    // Statistiques
    const stats = {};
    Object.keys(allData).forEach(collection => {
      stats[collection] = allData[collection].length;
    });

    log(`📈 Statistiques: ${JSON.stringify(stats)}`);

    return res.json({ 
      success: true, 
      data: allData,
      collections: collectionNames,
      statistics: stats,
      totalCollections: collectionNames.length
    });

  } catch (err) {
    error("❌ Erreur dans la fonction get-matrice : " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
