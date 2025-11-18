// routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const mongoose = require('mongoose');

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

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Limiter à 50 max

    const projects = await Project.find(query)
      .populate('members', 'name title email organization photo')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Project.countDocuments(query);

    res.json({
      success: true,
      projects,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
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
    // Validation de l'ID MongoDB
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de projet invalide' 
      });
    }

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
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le titre du projet est requis'
      });
    }

    // Vérifier les doublons (titre similaire)
    const existingProject = await Project.findOne({
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }
    });

    if (existingProject) {
      return res.status(409).json({
        success: false,
        message: 'Un projet avec ce titre existe déjà'
      });
    }

    // Nettoyer et valider les données
    const cleanTitle = title.trim().substring(0, 100);
    const cleanDescription = description ? description.trim().substring(0, 500) : '';
    const cleanOrganization = organization ? organization.trim().substring(0, 100) : '';

    // Préparer les tags
    let cleanTags = [];
    if (tags) {
      if (Array.isArray(tags)) {
        cleanTags = tags.map(tag => tag.toString().trim().substring(0, 30)).filter(tag => tag.length > 0).slice(0, 10);
      } else if (typeof tags === 'string') {
        cleanTags = tags.split(',')
          .map(tag => tag.trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      }
    }

    // Valider les membres
    let cleanMembers = [];
    if (members && Array.isArray(members)) {
      cleanMembers = members.filter(memberId => 
        mongoose.Types.ObjectId.isValid(memberId)
      );
    }

    const project = new Project({
      title: cleanTitle,
      description: cleanDescription,
      members: cleanMembers,
      status: ['idea', 'active', 'completed', 'archived'].includes(status) ? status : 'idea',
      organization: cleanOrganization,
      tags: cleanTags
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

    // Validation de l'ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de projet invalide' 
      });
    }

    // Vérifier si le projet existe
    const existingProject = await Project.findById(req.params.id);
    if (!existingProject) {
      return res.status(404).json({ 
        success: false, 
        message: 'Projet non trouvé' 
      });
    }

    // Vérifier les doublons si le titre change
    if (title && title !== existingProject.title) {
      const duplicateProject = await Project.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (duplicateProject) {
        return res.status(409).json({
          success: false,
          message: 'Un autre projet avec ce titre existe déjà'
        });
      }
    }

    const updateData = {};
    
    // Nettoyer et valider chaque champ
    if (title !== undefined) {
      updateData.title = title.trim().substring(0, 100);
    }
    if (description !== undefined) {
      updateData.description = description.trim().substring(0, 500);
    }
    if (members !== undefined) {
      updateData.members = Array.isArray(members) 
        ? members.filter(memberId => mongoose.Types.ObjectId.isValid(memberId))
        : [];
    }
    if (status !== undefined) {
      updateData.status = ['idea', 'active', 'completed', 'archived'].includes(status) 
        ? status 
        : existingProject.status;
    }
    if (organization !== undefined) {
      updateData.organization = organization.trim().substring(0, 100);
    }
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        updateData.tags = tags.map(tag => tag.toString().trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      } else if (typeof tags === 'string') {
        updateData.tags = tags.split(',')
          .map(tag => tag.trim().substring(0, 30))
          .filter(tag => tag.length > 0)
          .slice(0, 10);
      } else {
        updateData.tags = [];
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { 
        new: true,
        runValidators: true 
      }
    ).populate('members', 'name title email organization photo');

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
    // Validation de l'ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de projet invalide' 
      });
    }

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

// Les autres routes (members, stats) restent similaires mais avec validation d'ID ajoutée

module.exports = router;
