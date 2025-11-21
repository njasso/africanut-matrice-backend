// lib/mongodb.js - UTILITAIRE DE CONNEXION AVEC CACHE

import { MongoClient } from 'mongodb'

// Utilisez la nouvelle variable MONGODB_DB_NAME
const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_DB = process.env.MONGODB_DB_NAME // <-- CORRECTION APPORTÉE

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

if (!MONGODB_DB) {
  // Le message d'erreur est maintenant cohérent avec la variable
  throw new Error('Please define the MONGODB_DB_NAME environment variable') 
}

// Configuration du cache global pour les fonctions Serverless
let cached = global.mongo
if (!cached) {
  cached = global.mongo = { conn: null, promise: null }
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    // Les options 'useNewUrlParser' et 'useUnifiedTopology' ne sont plus nécessaires 
    // pour les versions récentes (6.x+) du driver MongoDB, mais elles ne causent pas d'erreur.
    const opts = {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    }

    cached.promise = MongoClient.connect(MONGODB_URI, opts).then((client) => {
      return {
        client,
        db: client.db(MONGODB_DB),
      }
    })
  }
  
  cached.conn = await cached.promise
  return cached.conn
}
