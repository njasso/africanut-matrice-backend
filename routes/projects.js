// routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// GET tous les projets avec filtres et pagination
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 12 } = req.query;
    
    // Construction de la query
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: {
        path: 'members',
        select: 'name title email organization photo'
      },
      sort: { createdAt: -1 }
    };

    const projects = await Project.find(query)
      .populate('members', 'name title email organization photo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Project.countDocuments(query);

    res.json({
      success: true,
      projects,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Erreur GET /projects:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors du chargement des projets' 
    });
  }
});

// GET un projet par ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('members', 'name title email phone organization photo specialties skills');

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Projet non trouvé' 
      });
    }

    res.json({
      success: true,
      project
    });
    
  } catch (error) {
    console.error('Erreur GET /projects/:id:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de projet invalide' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

// POST créer un nouveau projet
router.post('/', async (req, res) => {
  try {
    const { title, description, members, status, organization, tags } = req.body;

    // Validation des champs requis
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Le titre du projet est requis'
      });
    }

    const project = new Project({
      title,
      description: description || '',
      members: members || [],
      status: status || 'idea',
      organization: organization || '',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [])
    });

    const savedProject = await project.save();
    
    // Populer les données des membres pour la réponse
    await savedProject.populate('members', 'name title email organization photo');

    res.status(201).json({
      success: true,
      message: 'Projet créé avec succès',
      project: savedProject
    });
    
  } catch (error) {
    console.error('Erreur POST /projects:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: 'Données invalides', 
        errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création du projet' 
    });
  }
});

// PUT modifier un projet
router.put('/:id', async (req, res) => {
  try {
    const { title, description, members, status, organization, tags } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (members !== undefined) updateData.members = members;
    if (status !== undefined) updateData.status = status;
    if (organization !== undefined) updateData.organization = organization;
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { 
        new: true,
        runValidators: true 
      }
    ).populate('members', 'name title email organization photo');

    if (!updatedProject) {
      return res.status(404).json({ 
        success: false, 
        message: 'Projet non trouvé' 
      });
    }

    res.json({
      success: true,
      message: 'Projet modifié avec succès',
      project: updatedProject
    });
    
  } catch (error) {
    console.error('Erreur PUT /projects/:id:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: 'Données invalides', 
        errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la modification du projet' 
    });
  }
});

// DELETE supprimer un projet
router.delete('/:id', async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);

    if (!deletedProject) {
      return res.status(404).json({ 
        success: false, 
        message: 'Projet non trouvé' 
      });
    }

    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });
    
  } catch (error) {
    console.error('Erreur DELETE /projects/:id:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la suppression du projet' 
    });
  }
});

// POST ajouter un membre à un projet
router.post('/:id/members', async (req, res) => {
  try {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'ID du membre requis'
      });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Projet non trouvé' 
      });
    }

    // Vérifier si le membre est déjà dans le projet
    if (project.members.includes(memberId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le membre est déjà dans ce projet' 
      });
    }

    project.members.push(memberId);
    await project.save();

    await project.populate('members', 'name title email organization photo');

    res.json({
      success: true,
      message: 'Membre ajouté au projet avec succès',
      project
    });
    
  } catch (error) {
    console.error('Erreur POST /projects/:id/members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'ajout du membre' 
    });
  }
});

// DELETE retirer un membre d'un projet
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Projet non trouvé' 
      });
    }

    project.members = project.members.filter(
      member => member.toString() !== req.params.memberId
    );

    await project.save();
    await project.populate('members', 'name title email organization photo');

    res.json({
      success: true,
      message: 'Membre retiré du projet avec succès',
      project
    });
    
  } catch (error) {
    console.error('Erreur DELETE /projects/:id/members/:memberId:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du retrait du membre' 
    });
  }
});

// GET statistiques des projets
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Project.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          recent: {
            $push: {
              id: '$_id',
              title: '$title',
              createdAt: '$createdAt'
            }
          }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          recent: { $slice: ['$recent', 5] },
          _id: 0
        }
      }
    ]);

    const total = await Project.countDocuments();
    
    res.json({
      success: true,
      stats,
      total
    });
    
  } catch (error) {
    console.error('Erreur GET /projects/stats/summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du calcul des statistiques' 
    });
  }
});

module.exports = router;