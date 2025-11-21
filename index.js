// functions/matrice-complete/src/index.js - TOUTES LES FONCTIONS DANS UN SEUL FICHIER
import { MongoClient, ObjectId } from "mongodb";

export async function handler({ req, res, log, error }) {
  log("🚀 Fonction Matrice Complete lancée - Toutes collections");

  const MONGO_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

  if (!MONGO_URI) {
    return res.json({ success: false, message: "❌ MONGODB_URI manquante" });
  }

  let client;

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    const { path, method, body } = req;

    log(`📡 Route: ${method} ${path}`);

    // 🔥 FONCTIONS UTILITAIRES
    const parseStringToArray = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === 'string') {
        return data.split(/[,;&]/).map(item => item.trim()).filter(item => item);
      }
      return [String(data)];
    };

    const fixAssetUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('../assets/')) {
        return url.replace('../assets/', '/assets/');
      }
      return url;
    };

    // 🔥 ROUTE: GET /api/v1/all-data - TOUTES LES DONNÉES
    if (path === '/api/v1/all-data' && method === 'GET') {
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Récupérer toutes les collections
      const [members, skills, specialties, projects, interactions, analyses, groups] = await Promise.all([
        db.collection('members').find({}).toArray(),
        db.collection('skills').find({}).toArray(),
        db.collection('specialties').find({}).toArray(),
        db.collection('projects').find({}).toArray(),
        db.collection('interactions').find({}).toArray(),
        db.collection('analyses').find({}).toArray(),
        db.collection('groups').find({}).toArray()
      ]);

      // Formater les membres
      const formattedMembers = members.map(member => ({
        _id: member._id?.toString(),
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        phone: member.phone || '',
        organization: member.organization || '',
        location: member.location || '',
        specialties: parseStringToArray(member.specialties),
        skills: parseStringToArray(member.skills),
        projects: parseStringToArray(member.projects),
        experienceYears: member.experienceYears || 0,
        bio: member.bio || '',
        availability: member.availability || '',
        statutMembre: member.statutMembre || 'Actif',
        photo: fixAssetUrl(member.photo),
        cvLink: fixAssetUrl(member.cvLink),
        linkedin: member.linkedin || '',
        isActive: member.isActive !== undefined ? member.isActive : true,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      }));

      // Formater les projets
      const formattedProjects = projects.map(project => ({
        _id: project._id?.toString(),
        title: project.title || project.name || '',
        description: project.description || '',
        status: project.status || 'idea',
        organization: project.organization || '',
        tags: Array.isArray(project.tags) ? project.tags : [],
        members: Array.isArray(project.members) ? project.members : [],
        budget: project.budget || 0,
        progress: project.progress || 0,
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        createdBy: project.createdBy || '',
        createdAt: project.createdAt || new Date(),
        updatedAt: project.updatedAt || new Date()
      }));

      return res.json({
        success: true,
        data: {
          members: formattedMembers,
          skills: skills.map(s => ({ ...s, _id: s._id?.toString() })),
          specialties: specialties.map(s => ({ ...s, _id: s._id?.toString() })),
          projects: formattedProjects,
          interactions: interactions.map(i => ({ ...i, _id: i._id?.toString() })),
          analyses: analyses.map(a => ({ ...a, _id: a._id?.toString() })),
          groups: groups.map(g => ({ ...g, _id: g._id?.toString() }))
        },
        metadata: {
          totals: {
            members: members.length,
            skills: skills.length,
            specialties: specialties.length,
            projects: projects.length,
            interactions: interactions.length,
            analyses: analyses.length,
            groups: groups.length
          },
          collections: collectionNames,
          timestamp: new Date().toISOString()
        }
      });
    }

    // 🔥 ROUTES PROJETS
    // GET /api/v1/projects
    if (path === '/api/v1/projects' && method === 'GET') {
      const projects = await db.collection('projects').find({}).toArray();
      
      const formattedProjects = projects.map(project => ({
        _id: project._id?.toString(),
        title: project.title || project.name || '',
        description: project.description || '',
        status: project.status || 'idea',
        organization: project.organization || '',
        tags: Array.isArray(project.tags) ? project.tags : [],
        members: Array.isArray(project.members) ? project.members : [],
        budget: project.budget || 0,
        progress: project.progress || 0,
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        createdBy: project.createdBy || '',
        createdAt: project.createdAt || new Date(),
        updatedAt: project.updatedAt || new Date()
      }));

      return res.json({
        success: true,
        data: formattedProjects,
        total: formattedProjects.length,
        message: `${formattedProjects.length} projets récupérés`
      });
    }

    // POST /api/v1/projects
    if (path === '/api/v1/projects' && method === 'POST') {
      const projectData = typeof body === 'string' ? JSON.parse(body) : body;
      
      const newProject = {
        title: projectData.title,
        description: projectData.description,
        status: projectData.status || 'idea',
        organization: projectData.organization || '',
        tags: Array.isArray(projectData.tags) ? projectData.tags : [],
        members: Array.isArray(projectData.members) ? projectData.members : [],
        budget: projectData.budget || 0,
        progress: projectData.progress || 0,
        startDate: projectData.startDate || '',
        endDate: projectData.endDate || '',
        createdBy: projectData.createdBy || 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('projects').insertOne(newProject);
      
      return res.json({
        success: true,
        data: {
          _id: result.insertedId.toString(),
          ...newProject
        },
        message: "Projet créé avec succès"
      });
    }

    // PUT /api/v1/projects/:id
    if (path.startsWith('/api/v1/projects/') && method === 'PUT' && !path.includes('/members')) {
      const projectId = path.split('/').pop();
      
      if (!ObjectId.isValid(projectId)) {
        return res.json({ success: false, message: "ID de projet invalide" });
      }

      const updateData = typeof body === 'string' ? JSON.parse(body) : body;
      delete updateData._id;

      const result = await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { 
          $set: {
            ...updateData,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.json({ success: false, message: "Projet non trouvé" });
      }

      const updatedProject = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

      return res.json({
        success: true,
        data: {
          _id: updatedProject._id.toString(),
          ...updatedProject
        },
        message: "Projet mis à jour avec succès"
      });
    }

    // DELETE /api/v1/projects/:id
    if (path.startsWith('/api/v1/projects/') && method === 'DELETE') {
      const projectId = path.split('/').pop();
      
      if (!ObjectId.isValid(projectId)) {
        return res.json({ success: false, message: "ID de projet invalide" });
      }

      const result = await db.collection('projects').deleteOne({ _id: new ObjectId(projectId) });

      if (result.deletedCount === 0) {
        return res.json({ success: false, message: "Projet non trouvé" });
      }

      return res.json({
        success: true,
        message: "Projet supprimé avec succès",
        deletedId: projectId
      });
    }

    // POST /api/v1/projects/import-from-members
    if (path === '/api/v1/projects/import-from-members' && method === 'POST') {
      log("🔄 Importation des projets depuis les membres...");

      const members = await db.collection('members').find({}).toArray();
      const existingProjects = await db.collection('projects').find({}).toArray();

      const projectsToCreate = [];

      for (const member of members) {
        const existingProject = existingProjects.find(p => p.createdBy === member._id.toString());

        if (!existingProject) {
          const specialties = parseStringToArray(member.specialties);
          const skills = parseStringToArray(member.skills);

          const mainSpecialty = specialties[0] || 'Gestion de Projet';
          const projectTitle = `Projet ${mainSpecialty} - ${member.name.split(' ')[0]}`;
          
          const projectDescription = `Projet importé depuis le profil de ${member.name}. Spécialités: ${specialties.slice(0, 3).join(', ')}. Compétences: ${skills.slice(0, 3).join(', ')}`;

          const project = {
            title: projectTitle,
            description: projectDescription,
            status: ['idea', 'planning', 'active'][Math.floor(Math.random() * 3)],
            organization: member.organization || 'MINFOF',
            tags: specialties.slice(0, 5),
            members: [member._id.toString()],
            budget: Math.floor(Math.random() * 150000) + 50000,
            progress: Math.floor(Math.random() * 100),
            startDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            createdBy: member._id.toString(),
            createdAt: new Date(),
            updatedAt: new Date()
          };

          projectsToCreate.push(project);
        }
      }

      if (projectsToCreate.length > 0) {
        const result = await db.collection('projects').insertMany(projectsToCreate);
        
        return res.json({
          success: true,
          message: `${result.insertedCount} projets créés depuis les membres`,
          imported: result.insertedCount,
          totalMembers: members.length
        });
      } else {
        return res.json({
          success: true,
          message: "Aucun nouveau projet à créer",
          imported: 0,
          totalMembers: members.length
        });
      }
    }

    // GET /api/v1/projects/:id/members
    if (path.includes('/projects/') && path.includes('/members') && method === 'GET') {
      const projectId = path.split('/')[3];
      
      if (!ObjectId.isValid(projectId)) {
        return res.json({ success: false, message: "ID de projet invalide" });
      }

      const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
      
      if (!project) {
        return res.json({ success: false, message: "Projet non trouvé" });
      }

      const memberIds = project.members || [];
      const members = await db.collection('members')
        .find({ _id: { $in: memberIds.map(id => new ObjectId(id)) } })
        .toArray();

      const formattedMembers = members.map(member => ({
        _id: member._id?.toString(),
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        organization: member.organization || '',
        photo: member.photo || '',
        specialties: parseStringToArray(member.specialties)
      }));

      return res.json({
        success: true,
        data: formattedMembers,
        total: formattedMembers.length
      });
    }

    // 🔥 ROUTES MEMBRES
    // GET /api/v1/members
    if (path === '/api/v1/members' && method === 'GET') {
      const members = await db.collection('members').find({}).toArray();
      
      const formattedMembers = members.map(member => ({
        _id: member._id?.toString(),
        name: member.name || '',
        title: member.title || '',
        email: member.email || '',
        phone: member.phone || '',
        organization: member.organization || '',
        location: member.location || '',
        specialties: parseStringToArray(member.specialties),
        skills: parseStringToArray(member.skills),
        experienceYears: member.experienceYears || 0,
        bio: member.bio || '',
        availability: member.availability || '',
        statutMembre: member.statutMembre || 'Actif',
        photo: fixAssetUrl(member.photo),
        cvLink: fixAssetUrl(member.cvLink),
        linkedin: member.linkedin || '',
        isActive: member.isActive !== undefined ? member.isActive : true,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      }));

      return res.json({
        success: true,
        data: formattedMembers,
        total: formattedMembers.length,
        message: `${formattedMembers.length} membres récupérés`
      });
    }

    // POST /api/v1/members
    if (path === '/api/v1/members' && method === 'POST') {
      const memberData = typeof body === 'string' ? JSON.parse(body) : body;
      
      const newMember = {
        name: memberData.name,
        title: memberData.title || '',
        email: memberData.email || '',
        phone: memberData.phone || '',
        organization: memberData.organization || '',
        location: memberData.location || '',
        specialties: Array.isArray(memberData.specialties) ? memberData.specialties : [],
        skills: Array.isArray(memberData.skills) ? memberData.skills : [],
        experienceYears: memberData.experienceYears || 0,
        bio: memberData.bio || '',
        availability: memberData.availability || '',
        statutMembre: memberData.statutMembre || 'Actif',
        photo: memberData.photo || '',
        cvLink: memberData.cvLink || '',
        linkedin: memberData.linkedin || '',
        isActive: memberData.isActive !== undefined ? memberData.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('members').insertOne(newMember);
      
      return res.json({
        success: true,
        data: {
          _id: result.insertedId.toString(),
          ...newMember
        },
        message: "Membre créé avec succès"
      });
    }

    // 🔥 ROUTES SKILLS
    // GET /api/v1/skills
    if (path === '/api/v1/skills' && method === 'GET') {
      const skills = await db.collection('skills').find({}).toArray();
      
      return res.json({
        success: true,
        data: skills.map(skill => ({
          _id: skill._id?.toString(),
          name: skill.name || '',
          category: skill.category || '',
          description: skill.description || '',
          memberCount: skill.memberCount || 0
        })),
        total: skills.length
      });
    }

    // 🔥 ROUTES SPECIALTIES
    // GET /api/v1/specialties
    if (path === '/api/v1/specialties' && method === 'GET') {
      const specialties = await db.collection('specialties').find({}).toArray();
      
      return res.json({
        success: true,
        data: specialties.map(specialty => ({
          _id: specialty._id?.toString(),
          name: specialty.name || '',
          category: specialty.category || '',
          description: specialty.description || '',
          memberCount: specialty.memberCount || 0
        })),
        total: specialties.length
      });
    }

    // 🔥 ROUTES INTERACTIONS
    // GET /api/v1/interactions
    if (path === '/api/v1/interactions' && method === 'GET') {
      const interactions = await db.collection('interactions').find({}).toArray();
      
      return res.json({
        success: true,
        data: interactions.map(interaction => ({
          _id: interaction._id?.toString(),
          type: interaction.type || '',
          title: interaction.title || '',
          description: interaction.description || '',
          from: interaction.from || '',
          to: Array.isArray(interaction.to) ? interaction.to : [],
          projects: Array.isArray(interaction.projects) ? interaction.projects : [],
          status: interaction.status || '',
          participantCount: 1 + (interaction.to ? interaction.to.length : 0),
          createdAt: interaction.createdAt
        })),
        total: interactions.length
      });
    }

    // 🔥 ROUTES ANALYSES
    // GET /api/v1/analyses
    if (path === '/api/v1/analyses' && method === 'GET') {
      const analyses = await db.collection('analyses').find({}).toArray();
      
      return res.json({
        success: true,
        data: analyses.map(analysis => ({
          _id: analysis._id?.toString(),
          title: analysis.title || '',
          description: analysis.description || '',
          type: analysis.type || '',
          data: analysis.data || {},
          createdAt: analysis.createdAt,
          updatedAt: analysis.updatedAt
        })),
        total: analyses.length
      });
    }

    // 🔥 ROUTES GROUPS
    // GET /api/v1/groups
    if (path === '/api/v1/groups' && method === 'GET') {
      const groups = await db.collection('groups').find({}).toArray();
      
      return res.json({
        success: true,
        data: groups.map(group => ({
          _id: group._id?.toString(),
          name: group.name || '',
          description: group.description || '',
          type: group.type || '',
          members: Array.isArray(group.members) ? group.members : [],
          projects: Array.isArray(group.projects) ? group.projects : [],
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        })),
        total: groups.length
      });
    }

    // 🔥 ROUTE HEALTH CHECK
    if (path === '/api/v1/health' && method === 'GET') {
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      return res.json({
        success: true,
        message: "API Matrice en ligne",
        database: DB_NAME,
        collections: collectionNames,
        timestamp: new Date().toISOString(),
        status: "healthy"
      });
    }

    // Route non trouvée
    return res.json({ 
      success: false, 
      message: `Route non trouvée: ${method} ${path}` 
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    return res.json({ 
      success: false, 
      message: "Erreur serveur",
      error: err.message 
    });
  } finally {
    if (client) await client.close();
  }
}

export default handler;
