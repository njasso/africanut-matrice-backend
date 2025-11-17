import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    const msg = "❌ Variable MONGODB_URI manquante !";
    error(msg);
    return res.send(JSON.stringify({ 
      success: false, 
      message: msg,
      required: ['MONGODB_URI']
    }));
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB Atlas - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const allData = {};

    for (const collectionName of collectionNames) {
      try {
        const documents = await db.collection(collectionName).find({}).toArray();
        const formattedDocuments = documents.map(doc => ({ ...doc, _id: doc._id?.toString() }));
        allData[collectionName] = formattedDocuments;
        log(`✅ Collection "${collectionName}" : ${formattedDocuments.length} docs`);
      } catch (colError) {
        error(`❌ Erreur collection ${collectionName}: ${colError.message}`);
        allData[collectionName] = [];
      }
    }

    await client.close();
    log("🔒 Connexion MongoDB fermée");

    const stats = {};
    Object.keys(allData).forEach(col => stats[col] = allData[col].length);

    // ⚡ Ici on renvoie correctement le JSON pour Appwrite
    return res.send(JSON.stringify({ 
      success: true, 
      data: allData,
      collections: collectionNames,
      statistics: stats,
      totalCollections: collectionNames.length
    }));

  } catch (err) {
    error("❌ Erreur get-matrice : " + err.message);
    if (client) await client.close();
    return res.send(JSON.stringify({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }));
  }
}
