// functions/get-matrice/src/index.js - VERSION COMPLÈTE OPTIMISÉE

import { MongoClient } from "mongodb";

// 🔹 FONCTION UNIVERSELLE DE NETTOYAGE DES TABLEAUX
const cleanArray = (data, fieldName = '') => {
    if (!data) {
        console.log(`🔸 ${fieldName}: données nulles, retour tableau vide`);
        return [];
    }

    // Si c'est déjà un tableau
    if (Array.isArray(data)) {
        const cleaned = data
            .map(item => {
                if (typeof item === 'string') return item.trim();
                if (item && typeof item === 'object' && item.name) return item.name.trim();
                return String(item).trim();
            })
            .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
        
        console.log(`🔸 ${fieldName}: tableau de ${data.length} → ${cleaned.length} éléments après nettoyage`);
        return cleaned;
    }

    // Si c'est une chaîne avec séparateurs
    if (typeof data === 'string') {
        const cleaned = data
            .split(/[,;|]/)
            .map(item => item.trim())
            .filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
        
        console.log(`🔸 ${fieldName}: chaîne "${data.substring(0, 50)}..." → ${cleaned.length} éléments`);
        return cleaned;
    }

    // Cas par défaut
    return [String(data).trim()].filter(item => item && item !== '' && item !== 'null' && item !== 'undefined');
};

// 🔹 FONCTION DE FORMATAGE GÉNÉRIQUE DES COLLECTIONS
const formatCollection = (collection, mapper, collectionName = 'items') => {
    if (!Array.isArray(collection)) {
        console.log(`⚠️ ${collectionName}: collection non-tableau, conversion`);
        return [];
    }

    const formatted = collection
        .map((item, index) => {
            try {
                return mapper(item, index);
            } catch (error) {
                console.error(`❌ Erreur formatage ${collectionName}[${index}]:`, error.message);
                return null;
            }
        })
        .filter(item => item !== null);

    console.log(`✅ ${collectionName}: ${collection.length} → ${formatted.length} éléments formatés`);
    return formatted;
};

// 🔹 FONCTION DE CALCUL DES STATISTIQUES
const calculateStats = (members) => {
    const stats = {
        membersWithSpecialties: members.filter(m => m.specialties && m.specialties.length > 0).length,
        membersWithSkills: members.filter(m => m.skills && m.skills.length > 0).length,
        membersWithBoth: members.filter(m => 
            m.specialties && m.specialties.length > 0 && 
            m.skills && m.skills.length > 0
        ).length,
        totalSpecialties: [...new Set(members.flatMap(m => m.specialties || []))].length,
        totalSkills: [...new Set(members.flatMap(m => m.skills || []))].length,
        activeMembers: members.filter(m => m.isActive !== false).length,
        membersWithProjects: members.filter(m => m.projects && m.projects.trim() !== '').length
    };

    console.log(`📊 Statistiques calculées: ${stats.activeMembers}/${members.length} membres actifs`);
    return stats;
};

// 🔹 FONCTION DE VALIDATION ET CORRECTION URL PHOTO
const processPhotoUrl = (photoUrl) => {
    if (!photoUrl || typeof photoUrl !== 'string') return '';

    // Correction des chemins relatifs
    if (photoUrl.startsWith('../assets/photos/')) {
        return photoUrl.replace('../assets/photos/', '/assets/photos/');
    }

    // Ajout du slash initial si manquant pour les chemins locaux
    if (photoUrl.startsWith('assets/photos/') && !photoUrl.startsWith('/')) {
        return '/' + photoUrl;
    }

    return photoUrl;
};

// 🔹 FONCTION PRINCIPALE
export default async function handler({ req, res, log, error }) {
    log("🚀 Fonction Appwrite lancée : get-matrice - VERSION COMPLÈTE");

    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

    if (!MONGO_URI) {
        const msg = "❌ Variable MONGODB_URI manquante !";
        error(msg);
        return res.json({
            success: false,
            message: msg
        });
    }

    let client;

    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

        const db = client.db(DB_NAME);

        // 🔹 Récupérer TOUTES les collections avec gestion d'erreur individuelle
        log("📥 Récupération de toutes les collections...");

        const collectionPromises = {
            members: db.collection('members').find({}).toArray(),
            projects: db.collection('projects').find({}).sort({ createdAt: -1 }).toArray(),
            groups: db.collection('groups').find({}).toArray(),
            analyses: db.collection('analyses').find({}).sort({ createdAt: -1 }).toArray(),
            skills: db.collection('skills').find({}).toArray(),
            specialties: db.collection('specialties').find({}).toArray(),
            interactions: db.collection('interactions').find({}).sort({ createdAt: -1 }).toArray()
        };

        // 🔹 Exécution avec gestion d'erreur par collection
        const results = await Promise.allSettled(Object.values(collectionPromises));

        const [
            membersResult,
            projectsResult,
            groupsResult,
            analysesResult,
            skillsResult,
            specialtiesResult,
            interactionsResult
        ] = results;

        // 🔹 Extraction des données avec fallback
        const members = membersResult.status === 'fulfilled' ? membersResult.value : [];
        const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
        const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
        const analyses = analysesResult.status === 'fulfilled' ? analysesResult.value : [];
        const skills = skillsResult.status === 'fulfilled' ? skillsResult.value : [];
        const specialties = specialtiesResult.status === 'fulfilled' ? specialtiesResult.value : [];
        const interactions = interactionsResult.status === 'fulfilled' ? interactionsResult.value : [];

        // 🔹 Log des erreurs individuelles
        const errors = results.filter(result => result.status === 'rejected');
        if (errors.length > 0) {
            log(`⚠️ ${errors.length} collection(s) avec erreurs:`);
            errors.forEach((err, index) => {
                const collectionNames = Object.keys(collectionPromises);
                const failedIndex = results.findIndex(r => r.status === 'rejected');
                const failedKey = collectionNames[failedIndex];
                error(`❌ Erreur collection ${failedKey}: ${err.reason?.message || 'Erreur inconnue'}`);
            });
        }

        log(`✅ Données brutes récupérées: ${members.length} membres, ${projects.length} projets`);

        // 🔹 CORRECTION OPTIMISÉE DES MEMBRES
        const formattedMembers = formatCollection(members, (member) => {
            const memberSpecialties = cleanArray(member.specialties, 'specialties');
            const memberSkills = cleanArray(member.skills, 'skills');

            return {
                _id: member._id?.toString() || `temp-${Date.now()}-${Math.random()}`,
                name: member.name || 'Nom non renseigné',
                title: member.title || '',
                email: member.email || '',
                phone: member.phone || '',
                specialties: memberSpecialties,
                skills: memberSkills,
                location: member.location || '',
                organization: member.organization || '',
                entreprise: member.entreprise || '',
                experienceYears: member.experienceYears || 0,
                projects: member.projects || '',
                availability: member.availability || '',
                statutMembre: member.statutMembre || 'Actif',
                photo: processPhotoUrl(member.photo),
                cvLink: member.cvLink || '',
                linkedin: member.linkedin || '',
                isActive: member.isActive !== undefined ? member.isActive : true,
                createdAt: member.createdAt || new Date(),
                updatedAt: member.updatedAt || new Date()
            };
        }, 'membres');
        
        // 🔹 CALCUL DES STATISTIQUES
        const stats = calculateStats(formattedMembers);
        
        // 🔹 FORMATAGE DES PROJETS
        const formattedProjects = formatCollection(projects, (project) => {
            // S'assurer que members est toujours un tableau
            let projectMembers = [];
            if (Array.isArray(project.members)) {
                projectMembers = project.members.map(m => m?.toString()).filter(Boolean);
            } else if (project.members) {
                projectMembers = [project.members.toString()];
            }

            return {
                _id: project._id?.toString(),
                title: project.title || 'Sans titre',
                description: project.description || '',
                members: projectMembers,
                status: project.status || 'idea',
                organization: project.organization || '',
                tags: Array.isArray(project.tags) ? project.tags : [],
                createdAt: project.createdAt || new Date(),
                importedFromMember: project.importedFromMember || false,
                memberSource: project.memberSource || ''
            };
        }, 'projets');

        // 🔹 FORMATAGE DES GROUPES
        const formattedGroups = formatCollection(groups, (group) => ({
            _id: group._id?.toString(),
            name: group.name || '',
            description: group.description || '',
            type: group.type || 'technique',
            privacy: group.privacy || 'public',
            tags: Array.isArray(group.tags) ? group.tags : [],
            members: group.members ? group.members.map(m => m?.toString()).filter(Boolean) : [],
            leader: group.leader?.toString() || null,
            memberCount: group.members ? group.members.length : 0
        }), 'groupes');

        // 🔹 FORMATAGE DES ANALYSES
        const formattedAnalyses = formatCollection(analyses, (analysis) => ({
            _id: analysis._id?.toString(),
            type: analysis.type || 'interaction_analysis',
            title: analysis.title || '',
            description: analysis.description || '',
            insights: analysis.insights || {},
            suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
            statistics: analysis.statistics || {},
            status: analysis.status || 'completed',
            analysisTimestamp: analysis.analysisTimestamp || analysis.createdAt
        }), 'analyses');

        // 🔹 FORMATAGE DES COMPÉTENCES
        const formattedSkills = formatCollection(skills, (skill) => ({
            _id: skill._id?.toString(),
            name: skill.name || '',
            category: skill.category || 'technique',
            description: skill.description || '',
            memberCount: skill.memberCount || 0
        }), 'compétences');

        // 🔹 FORMATAGE DES SPÉCIALITÉS
        const formattedSpecialties = formatCollection(specialties, (specialty) => ({
            _id: specialty._id?.toString(),
            name: specialty.name || '',
            category: specialty.category || 'technique',
            description: specialty.description || '',
            memberCount: specialty.memberCount || 0
        }), 'spécialités');

        // 🔹 FORMATAGE DES INTERACTIONS
        const formattedInteractions = formatCollection(interactions, (interaction) => ({
            _id: interaction._id?.toString(),
            type: interaction.type || 'message',
            title: interaction.title || '',
            description: interaction.description || '',
            from: interaction.from?.toString() || '',
            to: interaction.to ? interaction.to.map(t => t?.toString()).filter(Boolean) : [],
            projects: interaction.projects ? interaction.projects.map(p => p?.toString()).filter(Boolean) : [],
            status: interaction.status || 'pending',
            participantCount: 1 + (interaction.to ? interaction.to.length : 0)
        }), 'interactions');

        await client.close();
        log("✅ Connexion MongoDB fermée");

        // 🔹 PRÉPARATION DE LA RÉPONSE
        const responseData = {
            success: true,

            // Format principal pour compatibilité
            projects: formattedProjects,
            members: formattedMembers,

            // Structure complète
            data: {
                members: formattedMembers,
                projects: formattedProjects,
                groups: formattedGroups,
                analyses: formattedAnalyses,
                skills: formattedSkills,
                specialties: formattedSpecialties,
                interactions: formattedInteractions
            },

            // Métadonnées enrichies
            metadata: {
                totals: {
                    members: formattedMembers.length,
                    projects: formattedProjects.length,
                    groups: formattedGroups.length,
                    analyses: formattedAnalyses.length,
                    skills: formattedSkills.length,
                    specialties: formattedSpecialties.length,
                    interactions: formattedInteractions.length
                },
                skillsStats: stats,
                collectionErrors: errors.length,
                timestamp: new Date().toISOString(),
                database: DB_NAME,
                version: '2.0.0'
            },
            
            message: `Données chargées: ${formattedMembers.length} membres, ${formattedProjects.length} projets, ${stats.collectionErrors} erreurs de collection`
        };

        log(`✅ Réponse préparée: ${formattedMembers.length} membres, ${formattedProjects.length} projets`);
        return res.json(responseData);

    } catch (err) {
        error("❌ Erreur critique: " + err.message);
        if (client) {
            await client.close().catch(e => error("Erreur fermeture client: " + e.message));
        }
        return res.json({
            success: false,
            message: "Erreur lors du chargement des données",
            error: process.env.NODE_ENV === 'development' ? err.message : 'Contactez l\'administrateur',
            timestamp: new Date().toISOString()
        });
    }
}
