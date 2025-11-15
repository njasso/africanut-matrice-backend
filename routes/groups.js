import express from "express";
import Group from "../models/Group.js";
import Member from "../models/Member.js";
import mongoose from "mongoose";

const router = express.Router();

// 🔹 Middleware de validation ObjectId
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ 
      success: false,
      message: "ID de groupe invalide" 
    });
  }
  next();
};

// 🔹 GET /api/v1/groups - Liste tous les groupes avec pagination et filtres
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      privacy,
      status = "active",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Construction de la query
    let query = { status };
    
    if (type && type !== "all") query.type = type;
    if (privacy) query.privacy = privacy;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } }
      ];
    }

    // Options de pagination
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
      populate: [
        { path: "members", select: "name email organization title" },
        { path: "leader", select: "name email" },
        { path: "metadata.createdBy", select: "name email" }
      ],
      lean: true
    };

    // Exécution de la query avec pagination
    const groups = await Group.find(query)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .populate(options.populate);

    const total = await Group.countDocuments(query);

    res.json({
      success: true,
      data: {
        groups: groups.map(group => ({
          ...group,
          memberCount: group.members ? group.members.length : 0
        })),
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalGroups: total,
          hasNext: options.page < Math.ceil(total / options.limit),
          hasPrev: options.page > 1
        }
      }
    });

  } catch (error) {
    console.error("❌ GET /api/v1/groups error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des groupes",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 GET /api/v1/groups/:id - Détails d'un groupe spécifique
router.get("/:id", validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "name email organization title phone department specialties")
      .populate("leader", "name email organization title")
      .populate("metadata.createdBy", "name email");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Groupe non trouvé"
      });
    }

    res.json({
      success: true,
      data: group
    });

  } catch (error) {
    console.error("❌ GET /api/v1/groups/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du groupe",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 POST /api/v1/groups - Créer un nouveau groupe
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      type = "technique",
      privacy = "public",
      tags = [],
      members = [],
      leader,
      autoCreated = false,
      creationType = "manual"
    } = req.body;

    // Validation des données requises
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Le nom et la description sont obligatoires"
      });
    }

    // Vérifier si les membres existent
    if (members.length > 0) {
      const existingMembers = await Member.find({ _id: { $in: members } });
      if (existingMembers.length !== members.length) {
        return res.status(400).json({
          success: false,
          message: "Un ou plusieurs membres n'existent pas"
        });
      }
    }

    // Vérifier le leader
    if (leader && !members.includes(leader)) {
      return res.status(400).json({
        success: false,
        message: "Le leader doit être membre du groupe"
      });
    }

    // Création du groupe
    const groupData = {
      name: name.trim(),
      description: description.trim(),
      type,
      privacy,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
      members,
      leader: leader || null,
      autoCreated,
      creationType,
      metadata: {
        createdBy: req.user?._id || null, // Si vous avez l'authentification
        lastActivity: new Date(),
        memberCount: members.length
      }
    };

    const group = new Group(groupData);
    await group.save();

    // Populer les données pour la réponse
    await group.populate([
      { path: "members", select: "name email organization title" },
      { path: "leader", select: "name email" }
    ]);

    res.status(201).json({
      success: true,
      message: "Groupe créé avec succès",
      data: group
    });

  } catch (error) {
    console.error("❌ POST /api/v1/groups error:", error);
    
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Données de validation invalides",
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Erreur lors de la création du groupe",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 PUT /api/v1/groups/:id - Mettre à jour un groupe
router.put("/:id", validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Groupe non trouvé"
      });
    }

    // Mise à jour des champs autorisés
    const allowedUpdates = ["name", "description", "type", "privacy", "tags", "status"];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        group[field] = req.body[field];
      }
    });

    group.metadata.lastActivity = new Date();
    await group.save();

    await group.populate([
      { path: "members", select: "name email organization title" },
      { path: "leader", select: "name email" }
    ]);

    res.json({
      success: true,
      message: "Groupe mis à jour avec succès",
      data: group
    });

  } catch (error) {
    console.error("❌ PUT /api/v1/groups/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour du groupe",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 DELETE /api/v1/groups/:id - Supprimer un groupe (archivage)
router.delete("/:id", validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Groupe non trouvé"
      });
    }

    // Archivage au lieu de suppression
    group.status = "archived";
    await group.save();

    res.json({
      success: true,
      message: "Groupe archivé avec succès"
    });

  } catch (error) {
    console.error("❌ DELETE /api/v1/groups/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'archivage du groupe",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 GET /api/v1/groups/:id/members - Récupérer les membres d'un groupe organisés
router.get("/:id/members", validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "name email organization title department specialties");

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Groupe non trouvé"
      });
    }

    // Organiser les membres
    const organizedMembers = organizeMembers(group.members);

    res.json({
      success: true,
      data: {
        members: group.members,
        organizedMembers,
        totalMembers: group.members.length,
        groupInfo: {
          name: group.name,
          type: group.type,
          privacy: group.privacy
        }
      }
    });

  } catch (error) {
    console.error("❌ GET /api/v1/groups/:id/members error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des membres",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 POST /api/v1/groups/:id/members - Ajouter des membres à un groupe
router.post("/:id/members", validateObjectId, async (req, res) => {
  try {
    const { memberIds } = req.body;
    
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La liste des IDs de membres est requise"
      });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Groupe non trouvé"
      });
    }

    // Vérifier l'existence des membres
    const existingMembers = await Member.find({ _id: { $in: memberIds } });
    if (existingMembers.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: "Un ou plusieurs membres n'existent pas"
      });
    }

    // Ajouter les nouveaux membres (éviter les doublons)
    const newMembers = memberIds.filter(id => 
      !group.members.some(existingId => existingId.equals(id))
    );

    if (newMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tous les membres sont déjà dans le groupe"
      });
    }

    group.members.push(...newMembers);
    group.metadata.lastActivity = new Date();
    await group.save();

    await group.populate("members", "name email organization title");

    res.json({
      success: true,
      message: `${newMembers.length} membre(s) ajouté(s) au groupe`,
      data: {
        addedMembers: newMembers,
        totalMembers: group.members.length
      }
    });

  } catch (error) {
    console.error("❌ POST /api/v1/groups/:id/members error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'ajout des membres",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 DELETE /api/v1/groups/:id/members/:memberId - Retirer un membre d'un groupe
router.delete("/:id/members/:memberId", validateObjectId, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Groupe non trouvé"
      });
    }

    const memberIndex = group.members.findIndex(id => 
      id.toString() === req.params.memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Membre non trouvé dans le groupe"
      });
    }

    // Retirer le membre
    group.members.splice(memberIndex, 1);
    
    // Si c'était le leader, retirer le leader
    if (group.leader && group.leader.toString() === req.params.memberId) {
      group.leader = null;
    }

    group.metadata.lastActivity = new Date();
    await group.save();

    res.json({
      success: true,
      message: "Membre retiré du groupe avec succès",
      data: {
        totalMembers: group.members.length
      }
    });

  } catch (error) {
    console.error("❌ DELETE /api/v1/groups/:id/members/:memberId error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du retrait du membre",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 POST /api/v1/groups/auto-create - Création automatique de groupes
router.post("/auto-create", async (req, res) => {
  try {
    const { criteria, type = "technique", privacy = "public" } = req.body;
    
    if (!criteria || !["byTitle", "byOrganization"].includes(criteria)) {
      return res.status(400).json({
        success: false,
        message: "Critère de création automatique invalide"
      });
    }

    // Récupérer tous les membres
    const members = await Member.find({}).select("name email organization title");
    
    if (members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucun membre trouvé pour la création automatique"
      });
    }

    let groupsCreated = 0;
    const createdGroups = [];

    if (criteria === "byTitle") {
      // Regrouper par titre
      const titles = [...new Set(members.map(m => m.title).filter(title => title && title.trim() !== ""))];
      
      for (const title of titles) {
        const membersWithTitle = members.filter(m => m.title === title);
        
        if (membersWithTitle.length > 0) {
          const group = new Group({
            name: `Groupe ${title}`,
            description: `Membres avec le titre: ${title}`,
            type,
            privacy,
            tags: [title.toLowerCase().replace(/\s+/g, '_'), "auto-creé", "par-titre"],
            members: membersWithTitle.map(m => m._id),
            autoCreated: true,
            creationType: "byTitle",
            metadata: {
              memberCount: membersWithTitle.length,
              lastActivity: new Date()
            }
          });

          await group.save();
          await group.populate("members", "name email");
          createdGroups.push(group);
          groupsCreated++;
        }
      }
    } else if (criteria === "byOrganization") {
      // Regrouper par organisation
      const organizations = [...new Set(members.map(m => m.organization).filter(org => org && org.trim() !== ""))];
      
      for (const org of organizations) {
        const membersWithOrg = members.filter(m => m.organization === org);
        
        if (membersWithOrg.length > 0) {
          const group = new Group({
            name: `Groupe ${org}`,
            description: `Membres de l'organisation: ${org}`,
            type: "sectoriel",
            privacy,
            tags: [org.toLowerCase().replace(/\s+/g, '_'), "auto-creé", "par-organisation"],
            members: membersWithOrg.map(m => m._id),
            autoCreated: true,
            creationType: "byOrganization",
            metadata: {
              memberCount: membersWithOrg.length,
              lastActivity: new Date()
            }
          });

          await group.save();
          await group.populate("members", "name email");
          createdGroups.push(group);
          groupsCreated++;
        }
      }
    }

    res.json({
      success: true,
      message: `${groupsCreated} groupes créés automatiquement`,
      data: {
        criteria,
        groupsCreated,
        groups: createdGroups
      }
    });

  } catch (error) {
    console.error("❌ POST /api/v1/groups/auto-create error:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création automatique",
      error: process.env.NODE_ENV === "production" ? null : error.message
    });
  }
});

// 🔹 Fonction utilitaire pour organiser les membres
function organizeMembers(members) {
  const byTitle = {};
  const byOrganization = {};

  members.forEach(member => {
    const title = member.title || "Sans titre";
    if (!byTitle[title]) byTitle[title] = [];
    byTitle[title].push(member);

    const organization = member.organization || "Sans organisation";
    if (!byOrganization[organization]) byOrganization[organization] = [];
    byOrganization[organization].push(member);
  });

  return { byTitle, byOrganization };
}

export default router;
