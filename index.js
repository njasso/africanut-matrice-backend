// index.js

/**
 * Point d'entrée principal pour la fonction Appwrite.
 * * Ce fichier utilise l'application Express (app) exportée par server.js.
 * * En mode Appwrite, Appwrite démarre l'application et envoie la requête
 * à la route /api/v1/execute-function (ou à l'endpoint principal de la fonction).
 * Pour simplifier, nous utilisons le fichier server.js exporté et ses
 * middlewares de routage.
 */

const app = require('./server'); // Importe l'application Express configurée dans server.js
const http = require('http');

// 🔹 CONFIGURATION SPÉCIFIQUE APPWRITE
const isAppwrite = process.env.APPWRITE_FUNCTION_ID !== undefined;
const PORT = process.env.PORT || 3000;

// ==========================================================
// 🔥 GESTION DU DÉMARRAGE DE LA FONCTION
// ==========================================================

if (isAppwrite) {
    // 🏗️ Mode Appwrite
    // Dans ce mode, Appwrite prend le contrôle de l'environnement HTTP.
    // Il est recommandé de laisser l'application Express écouter, 
    // ou si on utilise une infrastructure sans Express, de gérer la requête.
    
    // Puisque votre server.js démarre déjà avec app.listen(...) en bas
    // et exporte 'module.exports = app', Appwrite prendra en charge
    // le démarrage de ce module. Nous nous assurons ici de ne pas
    // redémarrer un listener si Appwrite s'en charge.

    console.log('📦 Fonction Appwrite en cours d\'exécution...');
    
    // Optionnel : Exporter l'application comme point d'entrée pour certains environnements Appwrite
    // Dans le cas de Node.js, l'exportation est généralement gérée
    // par le 'module.exports = app;' dans server.js, mais voici une approche propre :
    
    // Créer un serveur HTTP et l'attacher à l'application Express
    const server = http.createServer(app);
    
    // Écouter sur le port standard pour les fonctions Appwrite
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Appwrite Server Listening on port ${PORT}`);
    });
    
} else {
    // 💻 Mode Local (pour les tests de développement)
    // Le listener de 'server.js' sera déjà exécuté
    
    // Vous pouvez ajouter ici des scripts de démarrage ou de nettoyage spécifiques
    // au mode développement.
    console.log('🛠️ Mode Développement local. Le serveur a démarré via server.js.');
}

// --------------------------------------------------------------------------------
// NOTE IMPORTANTE SUR LE ROUTAGE :
// 
// Pour les fonctions Appwrite, toutes les requêtes du frontend *doivent* être 
// dirigées vers le seul endpoint de la fonction, par exemple :
// 
// POST /v1/functions/[FunctionID]/executions
// 
// Le corps de la requête Appwrite doit alors contenir :
// {
//     "path": "/api/v1/analyses",
//     "method": "POST",
//     "body": "{... data du POST ...}"
// }
//
// C'est la route **app.post('/api/v1/execute-function', ...)** de votre 
// 'server.js' qui gère cette redirection vers les CRUD internes (handleSave..., handleGet...).
//
// --------------------------------------------------------------------------------

module.exports = app;
