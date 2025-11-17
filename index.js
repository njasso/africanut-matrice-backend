// VERSION ULTRA-ROBUSTE
const fetchDataFromAppwrite = async () => {
  try {
    setLoading(true);
    setError(null);
    
    console.log("🔄 Chargement des données depuis AppWrite...");
    
    const response = await appwriteAxios.post(
      `/functions/${APPWRITE_FUNCTION_ID}/executions`,
      {},
      { timeout: 15000 }
    );
    
    console.log("📨 Réponse AppWrite complète:", response);
    
    // 🔹 EXTRACTION DES DONNÉES - TOUS LES CAS POSSIBLES
    let rawData = null;
    let dataSource = 'unknown';
    
    // Cas 1: responseBody comme string
    if (response.data.responseBody && typeof response.data.responseBody === 'string') {
      console.log("📦 Données dans responseBody (string)");
      rawData = JSON.parse(response.data.responseBody);
      dataSource = 'responseBody';
    }
    // Cas 2: responseBody déjà parsé
    else if (response.data.responseBody && typeof response.data.responseBody === 'object') {
      console.log("📦 Données dans responseBody (object)");
      rawData = response.data.responseBody;
      dataSource = 'responseBodyObject';
    }
    // Cas 3: response direct
    else if (response.data.response) {
      console.log("📦 Données dans response");
      rawData = response.data.response;
      dataSource = 'response';
    }
    // Cas 4: données directes
    else {
      console.log("📦 Données directes dans response.data");
      rawData = response.data;
      dataSource = 'direct';
    }
    
    console.log(`✅ Données extraites depuis: ${dataSource}`, rawData);
    
    // 🔹 VALIDATION DES DONNÉES
    if (!rawData) {
      throw new Error("Aucune donnée reçue");
    }
    
    if (!rawData.success) {
      throw new Error(rawData.message || "Réponse sans succès");
    }
    
    // 🔹 EXTRACTION PROJETS ET MEMBRES - TOUS LES FORMATS
    let projectsData = [];
    let membersData = [];
    
    // Format 1: Direct à la racine
    if (rawData.projects && Array.isArray(rawData.projects)) {
      projectsData = rawData.projects;
      console.log(`🎯 Projets trouvés à la racine: ${projectsData.length}`);
    }
    
    if (rawData.members && Array.isArray(rawData.members)) {
      membersData = rawData.members;
      console.log(`🎯 Membres trouvés à la racine: ${membersData.length}`);
    }
    
    // Format 2: Dans l'objet data
    if (rawData.data) {
      if (rawData.data.projects && Array.isArray(rawData.data.projects)) {
        projectsData = rawData.data.projects;
        console.log(`🎯 Projets trouvés dans data: ${projectsData.length}`);
      }
      
      if (rawData.data.members && Array.isArray(rawData.data.members)) {
        membersData = rawData.data.members;
        console.log(`🎯 Membres trouvés dans data: ${membersData.length}`);
      }
    }
    
    // 🔹 VALIDATION FINALE
    if (projectsData.length === 0 && membersData.length === 0) {
      console.warn("⚠️ Aucun projet ou membre trouvé dans la réponse:", rawData);
      throw new Error("Aucune donnée de projet ou membre trouvée");
    }
    
    // 🔹 MISE À JOUR DU STATE
    if (projectsData.length > 0) {
      setProjects(projectsData);
      console.log(`✅ ${projectsData.length} projets chargés`);
    }
    
    if (membersData.length > 0) {
      setMembers(membersData);
      console.log(`✅ ${membersData.length} membres chargés`);
    }
    
    console.log("🎉 Chargement réussi !");
    
  } catch (err) {
    console.error("❌ Erreur détaillée:", err);
    
    // Erreurs spécifiques AppWrite
    if (err.response) {
      console.error("📊 Détails erreur HTTP:", {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data
      });
      
      switch (err.response.status) {
        case 404:
          setError("Fonction AppWrite non trouvée (404)");
          break;
        case 401:
          setError("Accès non autorisé (401) - Vérifiez Project ID");
          break;
        case 500:
          setError("Erreur serveur AppWrite (500)");
          break;
        default:
          setError(`Erreur HTTP ${err.response.status}: ${err.response.statusText}`);
      }
    } 
    // Erreurs réseau
    else if (err.code === 'NETWORK_ERROR' || err.message.includes('Network Error')) {
      setError("Erreur réseau - Vérifiez votre connexion internet");
    }
    // Erreurs de parsing JSON
    else if (err.name === 'SyntaxError') {
      setError("Erreur de format JSON dans la réponse");
    }
    // Autres erreurs
    else {
      setError(err.message || "Erreur inconnue lors du chargement");
    }
    
    // Fallback sur données mock
    console.log("🔄 Chargement des données mock...");
    loadMockData();
    
  } finally {
    setLoading(false);
  }
};
