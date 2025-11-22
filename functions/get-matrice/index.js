// functions/get-matrice/src/index.js - VERSION COMPLÈTE CRUD

import { MongoClient, ObjectId } from "mongodb";

// 🔹 CACHE POUR PERFORMANCE
let cache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 🔹 CONFIGURATION DES PROJECTIONS
const collectionConfig = {
    members: { 
        projection: { 
            name: 1, title: 1, email: 1, specialties: 1, skills: 1, 
            organization: 1, isActive: 1, photo: 1, projects: 1,
            location: 1, entreprise: 1, experienceYears: 1, availability: 1,
            statutMembre: 1, cvLink: 1, linkedin: 1, createdAt: 1, updatedAt: 1
        } 
    },
    projects: { 
        projection: { 
            title: 1, description: 1, members: 1, status: 1, 
            organization: 1, tags: 1, createdAt: 1, importedFromMember: 1,
            memberSource: 1
        } 
    },
    groups: { 
        projection: { 
            name: 1, description: 1, type: 1, privacy: 1, tags: 1, 
            members: 1, leader: 1, memberCount: 1, autoCreated: 1,
            creationType: 1
        } 
    },
    analyses: { 
        projection: { 
            type: 1, title: 1, description: 1, insights: 1, 
            suggestions: 1, statistics: 1, status: 1, analysisTimestamp: 1,
            createdAt: 1
        } 
    },
    skills: { 
        projection: { 
            name: 1, category: 1, description: 1, memberCount: 1 
        } 
    },
    specialties: { 
        projection: { 
            name: 1, category: 1, description: 1, memberCount: 1 
        } 
    },
    interactions: { 
        projection: { 
            type: 1, title: 1, description: 1, from: 1, to: 1, 
            projects: 1, status: 1, participantCount: 1, createdAt: 1
        } 
    },
    synergy_analyses: {
        projection: {
            type: 1, title: 1, description: 1, analysisData: 1,
            statistics: 1, timestamp: 1, status: 1, aiEnhanced: 1,
            membersInvolved: 1, synergyScores: 1, recommendations: 1,
            createdAt: 1, updatedAt: 1, metadata: 1, source: 1
        }
    }
};

// 🔹 UTILITAIRES
const cleanArray = (data, fieldName = '') => {
    if (!data) return [];
    if (Array.isArray(data)) {
        return data.map(item => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object' && item.name) return item.name.trim();
            return String(item).trim();
        }).filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
    }
    if (typeof data === 'string') {
        return data.split(/[,;|]/).map(item => item.trim()).filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
    }
    return [String(data).trim()].filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
};

const processPhotoUrl = (photoUrl) => {
    if (!photoUrl || typeof photoUrl !== 'string') return '';
    if (photoUrl.startsWith('../assets/photos/')) {
        return photoUrl.replace('../assets/photos/', '/assets/photos/');
    }
    if (photoUrl.startsWith('assets/photos/') && !photoUrl.startsWith('/')) {
        return '/' + photoUrl;
    }
    try {
        new URL(photoUrl);
        return photoUrl;
    } catch {
        return photoUrl;
    }
};

const getPaginationParams = (req) => {
    const query = req.query || {};
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 0));
    const skip = (page - 1) * limit;
    return { page, limit, skip, hasPagination: limit > 0 };
};

const validateObjectId = (id) => {
    if (!id) return false;
    try {
        new ObjectId(id);
        return true;
    } catch {
        return false;
    }
};

const parseRequestBody = (body) => {
    if (!body) return {};
    if (typeof body === 'object') return body;
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        } catch {
            return {};
        }
    }
    return {};
};

// 🔹 CRUD POUR MEMBRES
const membersCRUD = {
    async getAll(db, { skip = 0, limit = 0 } = {}) {
        const members = await db.collection('members')
            .find({}, collectionConfig.members)
            .skip(skip)
            .limit(limit)
            .toArray();
        return members.map(member => ({
            ...member,
            _id: member._id.toString(),
            specialties: cleanArray(member.specialties),
            skills: cleanArray(member.skills)
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID membre invalide');
        const member = await db.collection('members').findOne({ _id: new ObjectId(id) }, collectionConfig.members);
        if (!member) throw new Error('Membre non trouvé');
        return {
            ...member,
            _id: member._id.toString(),
            specialties: cleanArray(member.specialties),
            skills: cleanArray(member.skills)
        };
    },

    async create(db, data) {
        const memberData = {
            name: data.name || 'Nom non renseigné',
            title: data.title || '',
            email: data.email || '',
            phone: data.phone || '',
            specialties: cleanArray(data.specialties, 'specialties'),
            skills: cleanArray(data.skills, 'skills'),
            location: data.location || '',
            organization: data.organization || '',
            entreprise: data.entreprise || '',
            experienceYears: data.experienceYears || 0,
            projects: data.projects || '',
            availability: data.availability || '',
            statutMembre: data.statutMembre || 'Actif',
            photo: processPhotoUrl(data.photo),
            cvLink: data.cvLink || '',
            linkedin: data.linkedin || '',
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('members').insertOne(memberData);
        return { ...memberData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID membre invalide');
        
        const updateData = { updatedAt: new Date() };
        
        // Champs modifiables
        if (data.name !== undefined) updateData.name = data.name;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.specialties !== undefined) updateData.specialties = cleanArray(data.specialties, 'specialties');
        if (data.skills !== undefined) updateData.skills = cleanArray(data.skills, 'skills');
        if (data.location !== undefined) updateData.location = data.location;
        if (data.organization !== undefined) updateData.organization = data.organization;
        if (data.entreprise !== undefined) updateData.entreprise = data.entreprise;
        if (data.experienceYears !== undefined) updateData.experienceYears = data.experienceYears;
        if (data.projects !== undefined) updateData.projects = data.projects;
        if (data.availability !== undefined) updateData.availability = data.availability;
        if (data.statutMembre !== undefined) updateData.statutMembre = data.statutMembre;
        if (data.photo !== undefined) updateData.photo = processPhotoUrl(data.photo);
        if (data.cvLink !== undefined) updateData.cvLink = data.cvLink;
        if (data.linkedin !== undefined) updateData.linkedin = data.linkedin;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        const result = await db.collection('members').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Membre non trouvé');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID membre invalide');
        const result = await db.collection('members').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Membre non trouvé');
        return { message: 'Membre supprimé avec succès', id };
    }
};

// 🔹 CRUD POUR PROJETS
const projectsCRUD = {
    async getAll(db, { skip = 0, limit = 0 } = {}) {
        const projects = await db.collection('projects')
            .find({}, collectionConfig.projects)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        return projects.map(project => ({
            ...project,
            _id: project._id.toString(),
            members: project.members ? project.members.map(m => m.toString()) : []
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID projet invalide');
        const project = await db.collection('projects').findOne({ _id: new ObjectId(id) }, collectionConfig.projects);
        if (!project) throw new Error('Projet non trouvé');
        return {
            ...project,
            _id: project._id.toString(),
            members: project.members ? project.members.map(m => m.toString()) : []
        };
    },

    async create(db, data) {
        const projectData = {
            title: data.title || 'Sans titre',
            description: data.description || '',
            members: Array.isArray(data.members) ? data.members.map(m => m.toString()).filter(Boolean) : [],
            status: data.status || 'idea',
            organization: data.organization || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            createdAt: new Date(),
            updatedAt: new Date(),
            importedFromMember: data.importedFromMember || false,
            memberSource: data.memberSource || ''
        };

        const result = await db.collection('projects').insertOne(projectData);
        return { ...projectData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID projet invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.members !== undefined) updateData.members = Array.isArray(data.members) ? data.members.map(m => m.toString()).filter(Boolean) : [];
        if (data.status !== undefined) updateData.status = data.status;
        if (data.organization !== undefined) updateData.organization = data.organization;
        if (data.tags !== undefined) updateData.tags = Array.isArray(data.tags) ? data.tags : [];
        if (data.importedFromMember !== undefined) updateData.importedFromMember = data.importedFromMember;
        if (data.memberSource !== undefined) updateData.memberSource = data.memberSource;

        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Projet non trouvé');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID projet invalide');
        const result = await db.collection('projects').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Projet non trouvé');
        return { message: 'Projet supprimé avec succès', id };
    }
};

// 🔹 CRUD POUR GROUPES
const groupsCRUD = {
    async getAll(db, { skip = 0, limit = 0 } = {}) {
        const groups = await db.collection('groups')
            .find({}, collectionConfig.groups)
            .skip(skip)
            .limit(limit)
            .toArray();
        return groups.map(group => ({
            ...group,
            _id: group._id.toString(),
            members: group.members ? group.members.map(m => m.toString()) : [],
            leader: group.leader ? group.leader.toString() : null
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID groupe invalide');
        const group = await db.collection('groups').findOne({ _id: new ObjectId(id) }, collectionConfig.groups);
        if (!group) throw new Error('Groupe non trouvé');
        return {
            ...group,
            _id: group._id.toString(),
            members: group.members ? group.members.map(m => m.toString()) : [],
            leader: group.leader ? group.leader.toString() : null
        };
    },

    async create(db, data) {
        const groupData = {
            name: data.name || '',
            description: data.description || '',
            type: data.type || 'technique',
            privacy: data.privacy || 'public',
            tags: Array.isArray(data.tags) ? data.tags : [],
            members: Array.isArray(data.members) ? data.members.map(m => m.toString()).filter(Boolean) : [],
            leader: data.leader ? data.leader.toString() : null,
            memberCount: Array.isArray(data.members) ? data.members.length : 0,
            autoCreated: data.autoCreated || false,
            creationType: data.creationType || 'manual',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('groups').insertOne(groupData);
        return { ...groupData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID groupe invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.privacy !== undefined) updateData.privacy = data.privacy;
        if (data.tags !== undefined) updateData.tags = Array.isArray(data.tags) ? data.tags : [];
        if (data.members !== undefined) {
            updateData.members = Array.isArray(data.members) ? data.members.map(m => m.toString()).filter(Boolean) : [];
            updateData.memberCount = updateData.members.length;
        }
        if (data.leader !== undefined) updateData.leader = data.leader ? data.leader.toString() : null;
        if (data.autoCreated !== undefined) updateData.autoCreated = data.autoCreated;
        if (data.creationType !== undefined) updateData.creationType = data.creationType;

        const result = await db.collection('groups').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Groupe non trouvé');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID groupe invalide');
        const result = await db.collection('groups').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Groupe non trouvé');
        return { message: 'Groupe supprimé avec succès', id };
    }
};

// 🔹 CRUD POUR ANALYSES
const analysesCRUD = {
    async getAll(db, { skip = 0, limit = 0 } = {}) {
        const analyses = await db.collection('analyses')
            .find({}, collectionConfig.analyses)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        return analyses.map(analysis => ({
            ...analysis,
            _id: analysis._id.toString(),
            suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : []
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID analyse invalide');
        const analysis = await db.collection('analyses').findOne({ _id: new ObjectId(id) }, collectionConfig.analyses);
        if (!analysis) throw new Error('Analyse non trouvée');
        return {
            ...analysis,
            _id: analysis._id.toString(),
            suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : []
        };
    },

    async create(db, data) {
        const analysisData = {
            type: data.type || 'interaction_analysis',
            title: data.title || '',
            description: data.description || '',
            insights: data.insights || {},
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            statistics: data.statistics || {},
            status: data.status || 'completed',
            analysisTimestamp: data.analysisTimestamp || new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('analyses').insertOne(analysisData);
        return { ...analysisData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID analyse invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.type !== undefined) updateData.type = data.type;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.insights !== undefined) updateData.insights = data.insights;
        if (data.suggestions !== undefined) updateData.suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        if (data.statistics !== undefined) updateData.statistics = data.statistics;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.analysisTimestamp !== undefined) updateData.analysisTimestamp = data.analysisTimestamp;

        const result = await db.collection('analyses').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Analyse non trouvée');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID analyse invalide');
        const result = await db.collection('analyses').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Analyse non trouvée');
        return { message: 'Analyse supprimée avec succès', id };
    }
};

// 🔹 CRUD POUR COMPÉTENCES
const skillsCRUD = {
    async getAll(db) {
        const skills = await db.collection('skills')
            .find({}, collectionConfig.skills)
            .toArray();
        return skills.map(skill => ({
            ...skill,
            _id: skill._id.toString()
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID compétence invalide');
        const skill = await db.collection('skills').findOne({ _id: new ObjectId(id) }, collectionConfig.skills);
        if (!skill) throw new Error('Compétence non trouvée');
        return { ...skill, _id: skill._id.toString() };
    },

    async create(db, data) {
        const skillData = {
            name: data.name || '',
            category: data.category || 'technique',
            description: data.description || '',
            memberCount: data.memberCount || 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('skills').insertOne(skillData);
        return { ...skillData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID compétence invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.name !== undefined) updateData.name = data.name;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.memberCount !== undefined) updateData.memberCount = data.memberCount;

        const result = await db.collection('skills').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Compétence non trouvée');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID compétence invalide');
        const result = await db.collection('skills').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Compétence non trouvée');
        return { message: 'Compétence supprimée avec succès', id };
    }
};

// 🔹 CRUD POUR SPÉCIALITÉS
const specialtiesCRUD = {
    async getAll(db) {
        const specialties = await db.collection('specialties')
            .find({}, collectionConfig.specialties)
            .toArray();
        return specialties.map(specialty => ({
            ...specialty,
            _id: specialty._id.toString()
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID spécialité invalide');
        const specialty = await db.collection('specialties').findOne({ _id: new ObjectId(id) }, collectionConfig.specialties);
        if (!specialty) throw new Error('Spécialité non trouvée');
        return { ...specialty, _id: specialty._id.toString() };
    },

    async create(db, data) {
        const specialtyData = {
            name: data.name || '',
            category: data.category || 'technique',
            description: data.description || '',
            memberCount: data.memberCount || 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('specialties').insertOne(specialtyData);
        return { ...specialtyData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID spécialité invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.name !== undefined) updateData.name = data.name;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.memberCount !== undefined) updateData.memberCount = data.memberCount;

        const result = await db.collection('specialties').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Spécialité non trouvée');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID spécialité invalide');
        const result = await db.collection('specialties').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Spécialité non trouvée');
        return { message: 'Spécialité supprimée avec succès', id };
    }
};

// 🔹 CRUD POUR INTERACTIONS
const interactionsCRUD = {
    async getAll(db, { skip = 0, limit = 0 } = {}) {
        const interactions = await db.collection('interactions')
            .find({}, collectionConfig.interactions)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        return interactions.map(interaction => ({
            ...interaction,
            _id: interaction._id.toString(),
            from: interaction.from ? interaction.from.toString() : '',
            to: interaction.to ? interaction.to.map(t => t.toString()) : [],
            projects: interaction.projects ? interaction.projects.map(p => p.toString()) : []
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID interaction invalide');
        const interaction = await db.collection('interactions').findOne({ _id: new ObjectId(id) }, collectionConfig.interactions);
        if (!interaction) throw new Error('Interaction non trouvée');
        return {
            ...interaction,
            _id: interaction._id.toString(),
            from: interaction.from ? interaction.from.toString() : '',
            to: interaction.to ? interaction.to.map(t => t.toString()) : [],
            projects: interaction.projects ? interaction.projects.map(p => p.toString()) : []
        };
    },

    async create(db, data) {
        const interactionData = {
            type: data.type || 'message',
            title: data.title || '',
            description: data.description || '',
            from: data.from ? data.from.toString() : '',
            to: Array.isArray(data.to) ? data.to.map(t => t.toString()).filter(Boolean) : [],
            projects: Array.isArray(data.projects) ? data.projects.map(p => p.toString()).filter(Boolean) : [],
            status: data.status || 'pending',
            participantCount: 1 + (Array.isArray(data.to) ? data.to.length : 0),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('interactions').insertOne(interactionData);
        return { ...interactionData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID interaction invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.type !== undefined) updateData.type = data.type;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.from !== undefined) updateData.from = data.from ? data.from.toString() : '';
        if (data.to !== undefined) {
            updateData.to = Array.isArray(data.to) ? data.to.map(t => t.toString()).filter(Boolean) : [];
            updateData.participantCount = 1 + updateData.to.length;
        }
        if (data.projects !== undefined) updateData.projects = Array.isArray(data.projects) ? data.projects.map(p => p.toString()).filter(Boolean) : [];
        if (data.status !== undefined) updateData.status = data.status;

        const result = await db.collection('interactions').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Interaction non trouvée');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID interaction invalide');
        const result = await db.collection('interactions').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Interaction non trouvée');
        return { message: 'Interaction supprimée avec succès', id };
    }
};

// 🔹 CRUD POUR ANALYSES DE SYNERGIE
const synergyAnalysesCRUD = {
    async getAll(db, { skip = 0, limit = 0 } = {}) {
        const analyses = await db.collection('synergy_analyses')
            .find({}, collectionConfig.synergy_analyses)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        return analyses.map(analysis => ({
            ...analysis,
            _id: analysis._id.toString()
        }));
    },

    async getById(db, id) {
        if (!validateObjectId(id)) throw new Error('ID analyse synergie invalide');
        const analysis = await db.collection('synergy_analyses').findOne({ _id: new ObjectId(id) }, collectionConfig.synergy_analyses);
        if (!analysis) throw new Error('Analyse synergie non trouvée');
        return { ...analysis, _id: analysis._id.toString() };
    },

    async create(db, data) {
        const analysisData = {
            type: data.type || 'professional_synergy_analysis',
            title: data.title || `Analyse Synergies ${new Date().toLocaleDateString('fr-FR')}`,
            description: data.description || 'Analyse de synergies professionnelles',
            analysisData: data.analysisData || {},
            statistics: data.statistics || {},
            timestamp: new Date(),
            status: 'completed',
            aiEnhanced: data.statistics?.aiEnhanced || false,
            membersInvolved: data.statistics?.totalMembers || 0,
            synergyScores: {
                average: data.analysisData?.synergies?.reduce((acc, s) => acc + (s.score || 0), 0) / (data.analysisData?.synergies?.length || 1) || 0,
                highPotential: data.statistics?.highPotentialSynergies || 0,
                total: data.statistics?.totalSynergies || 0
            },
            recommendations: data.analysisData?.projectOpportunities || [],
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                version: data.metadata?.version || '2.0.0',
                aiModel: data.statistics?.aiModel || 'algorithmic',
                processingTime: data.statistics?.processingTime || 0,
                source: data.metadata?.source || 'appwrite_function',
                deepAnalysis: data.metadata?.deepAnalysis || false,
                membersAnalyzed: data.metadata?.membersAnalyzed || 0
            }
        };

        const result = await db.collection('synergy_analyses').insertOne(analysisData);
        return { ...analysisData, _id: result.insertedId.toString() };
    },

    async update(db, id, data) {
        if (!validateObjectId(id)) throw new Error('ID analyse synergie invalide');
        
        const updateData = { updatedAt: new Date() };
        
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.analysisData !== undefined) updateData.analysisData = data.analysisData;
        if (data.statistics !== undefined) updateData.statistics = data.statistics;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.aiEnhanced !== undefined) updateData.aiEnhanced = data.aiEnhanced;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;

        const result = await db.collection('synergy_analyses').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) throw new Error('Analyse synergie non trouvée');
        return await this.getById(db, id);
    },

    async delete(db, id) {
        if (!validateObjectId(id)) throw new Error('ID analyse synergie invalide');
        const result = await db.collection('synergy_analyses').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Analyse synergie non trouvée');
        return { message: 'Analyse synergie supprimée avec succès', id };
    }
};

// 🔹 ROUTEUR PRINCIPAL
const routeHandlers = {
    // GET - Récupérer toutes les données
    async GET_ALL_DATA(db, req) {
        const { skip, limit, hasPagination } = getPaginationParams(req);
        
        const [
            members, projects, groups, analyses, skills, 
            specialties, interactions, synergyAnalyses
        ] = await Promise.all([
            membersCRUD.getAll(db, { skip: hasPagination ? skip : 0, limit: hasPagination ? limit : 0 }),
            projectsCRUD.getAll(db, { skip: hasPagination ? skip : 0, limit: hasPagination ? limit : 0 }),
            groupsCRUD.getAll(db, { skip: hasPagination ? skip : 0, limit: hasPagination ? limit : 0 }),
            analysesCRUD.getAll(db, { skip: hasPagination ? skip : 0, limit: hasPagination ? limit : 0 }),
            skillsCRUD.getAll(db),
            specialtiesCRUD.getAll(db),
            interactionsCRUD.getAll(db, { skip: hasPagination ? skip : 0, limit: hasPagination ? limit : 0 }),
            synergyAnalysesCRUD.getAll(db, { skip: hasPagination ? skip : 0, limit: hasPagination ? limit : 0 })
        ]);

        return {
            success: true,
            data: {
                members,
                projects,
                groups,
                analyses,
                skills,
                specialties,
                interactions,
                synergyAnalyses
            },
            metadata: {
                totals: {
                    members: members.length,
                    projects: projects.length,
                    groups: groups.length,
                    analyses: analyses.length,
                    skills: skills.length,
                    specialties: specialties.length,
                    interactions: interactions.length,
                    synergyAnalyses: synergyAnalyses.length
                },
                pagination: hasPagination ? { limit, skip, page: Math.floor(skip / limit) + 1 } : null,
                timestamp: new Date().toISOString()
            }
        };
    },

    // CRUD par collection et par ID
    async handleCRUD(db, collection, method, id, data) {
        const crudMap = {
            'members': membersCRUD,
            'projects': projectsCRUD,
            'groups': groupsCRUD,
            'analyses': analysesCRUD,
            'skills': skillsCRUD,
            'specialties': specialtiesCRUD,
            'interactions': interactionsCRUD,
            'synergy_analyses': synergyAnalysesCRUD
        };

        const crud = crudMap[collection];
        if (!crud) throw new Error(`Collection ${collection} non supportée`);

        switch (method) {
            case 'GET':
                return id ? await crud.getById(db, id) : await crud.getAll(db);
            case 'POST':
                return await crud.create(db, data);
            case 'PUT':
                if (!id) throw new Error('ID requis pour la mise à jour');
                return await crud.update(db, id, data);
            case 'DELETE':
                if (!id) throw new Error('ID requis pour la suppression');
                return await crud.delete(db, id);
            default:
                throw new Error(`Méthode ${method} non supportée`);
        }
    }
};

// 🔹 FONCTION PRINCIPALE
export default async function handler({ req, res, log, error }) {
    log(`🚀 Fonction Appwrite - Méthode: ${req.method}, Path: ${req.path}`);

    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

    if (!MONGO_URI) {
        return res.json({
            success: false,
            message: "❌ Variable MONGODB_URI manquante !",
            timestamp: new Date().toISOString()
        });
    }

    let client;

    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

        const db = client.db(DB_NAME);

        // 🔹 EXTRACTION DES PARAMÈTRES DE ROUTE
        const path = req.path || '';
        const method = req.method || 'GET';
        const body = parseRequestBody(req.body);
        
        log(`📡 Route: ${method} ${path}`, body);

        // Pattern: /api/v1/:collection/:id?
        const pathMatch = path.match(/\/api\/v1\/([a-zA-Z_]+)\/?([a-f0-9]{24})?/);
        const collection = pathMatch ? pathMatch[1] : null;
        const id = pathMatch ? pathMatch[2] : null;

        // 🔹 ROUTAGE DES REQUÊTES
        let result;

        if (method === 'GET' && path === '/api/v1/all-data') {
            // Route spéciale pour toutes les données
            result = await routeHandlers.GET_ALL_DATA(db, req);
        } else if (collection) {
            // CRUD par collection
            result = await routeHandlers.handleCRUD(db, collection, method, id, body);
        } else {
            throw new Error('Route non reconnue. Utilisez /api/v1/:collection ou /api/v1/all-data');
        }

        await client.close();

        return res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        error("❌ Erreur:", err.message);
        if (client) {
            await client.close().catch(e => error("Erreur fermeture client: " + e.message));
        }
        
        return res.json({
            success: false,
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
}
