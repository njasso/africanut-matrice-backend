// routes/members.js
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
    const { search, page = 1, limit = 12 } = req.query;
    let query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    // Pagination simple si mongoose-paginate non installé
    const members = Member.paginate
      ? await Member.paginate(query, options)
      : await Member.find(query)
          .limit(options.limit)
          .skip((options.page - 1) * options.limit)
          .sort(options.sort);

    res.json({ success: true, members: members.docs || members, pagination: members.pagination || null });
  } catch (err) {
    console.error("Erreur GET /members:", err);
    res.status(500).json({ success: false, message: "Erreur serveur lors du chargement des membres" });
  }
});

// GET un membre par ID
router.get("/:id", async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Membre non trouvé" });
    res.json({ success: true, member });
  } catch (err) {
    console.error("Erreur GET /members/:id:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// POST créer un membre
router.post("/", async (req, res) => {
  try {
    const { name, email, title, organization, photo } = req.body;
    if (!name || !email)
      return res.status(400).json({ success: false, message: "Nom et email requis" });

    const member = new Member({ name, email, title, organization, photo });
    const saved = await member.save();
    res.status(201).json({ success: true, message: "Membre créé avec succès", member: saved });
  } catch (err) {
    console.error("Erreur POST /members:", err);
    res.status(500).json({ success: false, message: "Erreur serveur lors de la création" });
  }
});

// PUT modifier un membre
router.put("/:id", async (req, res) => {
  try {
    const updated = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Membre non trouvé" });
    res.json({ success: true, message: "Membre mis à jour", member: updated });
  } catch (err) {
    console.error("Erreur PUT /members/:id:", err);
    res.status(500).json({ success: false, message: "Erreur serveur lors de la modification" });
  }
});

// DELETE supprimer un membre (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Member.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!deleted) return res.status(404).json({ success: false, message: "Membre non trouvé" });
    res.json({ success: true, message: "Membre supprimé" });
  } catch (err) {
    console.error("Erreur DELETE /members/:id:", err);
    res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression" });
  }
});

module.exports = router;
