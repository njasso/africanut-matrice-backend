// routes/members.js - VERSION CORRIGÉE POUR VOTRE STRUCTURE
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// 🔹 MODÈLE SIMPLIFIÉ aligné avec votre structure de données
const memberSchema = new mongoose.Schema({
  name: String,
  title: String,
  email: String,
  phone: String,
  location: String,
  specialties: [String],
  skills: [String],
  organization: String,
  entreprise: String,
  projects: String,
  bio: String,
  statutMembre: { type: String, default: 'Actif' },
  isActive: { type: Boolean, default: true },
  experienceYears: Number,
  photo: String
}, { 
  timestamps: true,
  // Évite les erreurs de champs inconnus avec vos données existantes
  strict: false
});

// Création du modèle
const Member = mongoose.model('Member', memberSchema);

// 🔹 Middleware pour valider les ObjectId
router.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "ID de membre invalide" });
  }
  next();
});

// ==========================
// ROUTES PRINCIPALES - VERSION SIMPLIFIÉE
// ==========================

// 🔹 GET tous les membres (VERSION SIMPLIFIÉE POUR TEST)
router.get("/", async (req, res) => {
  try {
    console.log("🔍 Route /members appelée avec query:", req.query);
    
    const { 
      search, 
      page = 1, 
      limit = 50, 
      specialty, 
      location, 
      status,
      sort = 'name' 
    } = req.query;

    // Query de base - plus permissif
    let query = {};

    // Filtre texte global
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { title: searchRegex },
        { organization: searchRegex },
        { entreprise: searchRegex },
        { location: searchRegex },
        { specialties: searchRegex },
        { skills: searchRegex }
      ];
    }

    // Filtres spécifiques
    if (specialty && specialty.trim()) {
      query.specialties = new RegExp(specialty.trim(), 'i');
    }

    if (location && location.trim()) {
      query.location = new RegExp(location.trim(), 'i');
    }

    if (status && status.trim()) {
      query.statutMembre = new RegExp(status.trim(), 'i');
    }

    console.log("📋 Query MongoDB:", JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupération avec gestion d'erreur
    const members = await Member.find(query)
      .sort({ [sort]: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Retourne des objets JavaScript simples

    const total = await Member.countDocuments(query);

    console.log(`✅ ${members.length} membres trouvés sur ${total} total`);

    res.json({ 
      success: true, 
      data: members,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (err) {
    console.error("❌ Erreur GET /members:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors du chargement des membres", 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// 🔹 GET un membre par ID
router.get("/:id", async (req, res) => {
  try {
    console.log("🔍 Récupération membre ID:", req.params.id);
    
    const member = await Member.findById(req.params.id).lean();
    
    if (!member) {
      console.log("❌ Membre non trouvé:", req.params.id);
      return res.status(404).json({ success: false, message: "Membre non trouvé" });
    }

    console.log("✅ Membre trouvé:", member.name);
    res.json({ success: true, data: member });

  } catch (err) {
    console.error("❌ Erreur GET /members/:id:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la récupération du membre", 
      error: err.message 
    });
  }
});

// 🔹 POST créer un membre (VERSION SIMPLIFIÉE)
router.post("/", async (req, res) => {
  try {
    console.log("📝 Création nouveau membre:", req.body);
    
    const { name, email, title } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Nom et email sont requis" 
      });
    }

    // Vérifier si le membre existe déjà
    const existingMember = await Member.findOne({ email: email.trim().toLowerCase() });
    if (existingMember) {
      return res.status(409).json({ 
        success: false, 
        message: "Un membre avec cet email existe déjà" 
      });
    }

    const memberData = {
      ...req.body,
      // Normalisation des tableaux
      specialties: Array.isArray(req.body.specialties) ? req.body.specialties : [],
      skills: Array.isArray(req.body.skills) ? req.body.skills : [],
      statutMembre: req.body.statutMembre || 'Actif',
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    };

    const member = new Member(memberData);
    const savedMember = await member.save();

    console.log("✅ Membre créé:", savedMember._id);
    
    res.status(201).json({ 
      success: true, 
      message: "Membre créé avec succès", 
      data: savedMember 
    });

  } catch (err) {
    console.error("❌ Erreur POST /members:", err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: "Données invalides", 
        errors: err.errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la création du membre", 
      error: err.message 
    });
  }
});

// 🔹 ROUTE DE TEST - Récupère tous les membres sans filtre
router.get("/debug/all", async (req, res) => {
  try {
    console.log("🐛 Route debug - Récupération de TOUS les membres");
    
    const allMembers = await Member.find({}).limit(100).lean();
    
    console.log(`📊 ${allMembers.length} membres trouvés dans la collection`);
    
    // Affiche un échantillon pour debug
    if (allMembers.length > 0) {
      console.log("📝 Échantillon du premier membre:", JSON.stringify(allMembers[0], null, 2));
    }

    res.json({ 
      success: true, 
      total: allMembers.length,
      data: allMembers,
      sample: allMembers.length > 0 ? allMembers[0] : null
    });

  } catch (err) {
    console.error("❌ Erreur route debug:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur debug", 
      error: err.message 
    });
  }
});

// 🔹 ROUTE DE TEST - Compte les documents
router.get("/debug/count", async (req, res) => {
  try {
    const totalCount = await Member.countDocuments({});
    const activeCount = await Member.countDocuments({ isActive: true });
    const statusCounts = await Member.aggregate([
      { $group: { _id: '$statutMembre', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      counts: {
        total: totalCount,
        active: activeCount,
        byStatus: statusCounts
      }
    });

  } catch (err) {
    console.error("❌ Erreur count debug:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur count", 
      error: err.message 
    });
  }
});

module.exports = router;
