// routes/members.js - VERSION VÉRIFIÉE ET CORRIGÉE
const express = require("express");
const mongoose = require("mongoose");
const Member = require("../models/Member");
const router = express.Router();

// 🔹 Middleware pour valider les ObjectId
router.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "ID de membre invalide" });
  }
  next();
});

// ==========================
// ROUTES PRINCIPALES
// ==========================

// GET tous les membres avec filtres et pagination
router.get("/", async (req, res) => {
  try {
    const { 
      search, 
      page = 1, 
      limit = 12,
      specialty,
      organization,
      location,
      sort = 'name'
    } = req.query;

    let query = {};

    // Filtre de recherche texte
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { organization: { $regex: search, $options: "i" } },
        { specialties: { $in: [new RegExp(search, 'i')] } },
        { skills: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Filtre par spécialité
    if (specialty) {
      query.specialties = { $in: [new RegExp(specialty, 'i')] };
    }

    // Filtre par organisation
    if (organization) {
      query.organization = { $regex: organization, $options: 'i' };
    }

    // Filtre par localisation
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Exécution de la requête
    const members = await Member.find(query)
      .sort({ [sort]: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name title email organization specialties experienceYears photo location skills');

    const total = await Member.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({ 
      success: true, 
      members,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMembers: total,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (err) {
    console.error("❌ Erreur GET /members:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors du chargement des membres",
      error: err.message 
    });
  }
});

// GET un membre par ID
router.get("/:id", async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé" 
      });
    }
    
    res.json({ 
      success: true, 
      member 
    });
  } catch (err) {
    console.error("❌ Erreur GET /members/:id:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la récupération du membre",
      error: err.message 
    });
  }
});

// POST créer un membre
router.post("/", async (req, res) => {
  try {
    const { 
      name, 
      email, 
      title, 
      organization, 
      phone,
      specialties,
      skills,
      location,
      experienceYears,
      photo 
    } = req.body;

    // Validation des champs requis
    if (!name || !email || !title) {
      return res.status(400).json({ 
        success: false, 
        message: "Nom, email et titre sont requis" 
      });
    }

    // Vérifier si l'email existe déjà
    const existingMember = await Member.findOne({ email });
    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "Un membre avec cet email existe déjà"
      });
    }

    const member = new Member({ 
      name, 
      email, 
      title, 
      organization, 
      phone,
      specialties: Array.isArray(specialties) ? specialties : [],
      skills: Array.isArray(skills) ? skills : [],
      location,
      experienceYears: experienceYears || 0,
      photo 
    });

    const savedMember = await member.save();
    
    res.status(201).json({ 
      success: true, 
      message: "Membre créé avec succès", 
      member: savedMember 
    });
  } catch (err) {
    console.error("❌ Erreur POST /members:", err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Données de validation invalides",
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

// PUT modifier un membre
router.put("/:id", async (req, res) => {
  try {
    const updatedMember = await Member.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { 
        new: true, 
        runValidators: true 
      }
    );
    
    if (!updatedMember) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Membre mis à jour avec succès", 
      member: updatedMember 
    });
  } catch (err) {
    console.error("❌ Erreur PUT /members/:id:", err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Données de validation invalides",
        errors: err.errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la modification du membre",
      error: err.message 
    });
  }
});

// DELETE supprimer un membre (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const deletedMember = await Member.findByIdAndUpdate(
      req.params.id, 
      { isActive: false }, 
      { new: true }
    );
    
    if (!deletedMember) {
      return res.status(404).json({ 
        success: false, 
        message: "Membre non trouvé" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Membre supprimé avec succès" 
    });
  } catch (err) {
    console.error("❌ Erreur DELETE /members/:id:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors de la suppression du membre",
      error: err.message 
    });
  }
});

// ==========================
// ROUTES SPÉCIALISÉES
// ==========================

// GET statistiques des membres
router.get("/stats/summary", async (req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const totalActive = await Member.countDocuments({ isActive: true });
    
    // Statistiques par organisation
    const orgStats = await Member.aggregate([
      { $match: { organization: { $ne: '', $exists: true } } },
      { $group: { _id: '$organization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Statistiques par spécialité
    const specialtyStats = await Member.aggregate([
      { $unwind: '$specialties' },
      { $group: { _id: '$specialties', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      stats: {
        totalMembers,
        totalActive,
        organizations: orgStats,
        specialties: specialtyStats,
        experience: {
          junior: await Member.countDocuments({ experienceYears: { $lt: 5 } }),
          intermediate: await Member.countDocuments({ experienceYears: { $gte: 5, $lt: 10 } }),
          senior: await Member.countDocuments({ experienceYears: { $gte: 10 } })
        }
      }
    });
  } catch (err) {
    console.error("❌ Erreur GET /members/stats/summary:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors du chargement des statistiques",
      error: err.message 
    });
  }
});

// GET métadonnées pour les filtres
router.get("/metadata/filters", async (req, res) => {
  try {
    const specialties = await Member.distinct('specialties');
    const organizations = await Member.distinct('organization');
    const locations = await Member.distinct('location');

    // Nettoyer et trier les données
    const cleanData = (arr) => {
      if (!arr) return [];
      return arr
        .filter(item => item && item.trim() !== '')
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    };

    res.json({
      success: true,
      metadata: {
        specialties: cleanData(specialties.flat()),
        organizations: cleanData(organizations),
        locations: cleanData(locations)
      }
    });
  } catch (err) {
    console.error("❌ Erreur GET /members/metadata/filters:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur lors du chargement des métadonnées",
      error: err.message 
    });
  }
});

module.exports = router;
