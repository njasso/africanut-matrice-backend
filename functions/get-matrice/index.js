// functions/get-matrice/src/index.js - VERSION COMPLÈTE OPTIMISÉE AVEC SYNERGIES

import { MongoClient, ObjectId } from "mongodb";

// 🔹 CACHE POUR PERFORMANCE
let cache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 🔹 CONFIGURATION DES PROJECTIONS POUR OPTIMISATION
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

// 🔹 GESTION ROBUSTE DES ERREURS PAR COLLECTION
const handleCollectionError = (result, collectionName, log, error, fallback = []) => {
    if (result.status === 'fulfilled') {
        log(`✅ Collection ${collectionName} chargée: ${result.value.length} éléments`);
        return result.value;
    } else {
        error(`❌ Collection ${collectionName} inaccessible: ${result.reason?.message}`);
        return fallback;
    }
};

// 🔹 CALCUL DES STATISTIQUES AVANCÉES
const getMostCommonItems = (items, limit = 10) => {
    const frequency = {};
    items.forEach(item => {
        frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([item, count]) => ({ item, count }));
};

const calculateEnhancedStats = (members, projects, groups, skills, specialties, synergyAnalyses = []) => {
    const allSkills = members.flatMap(m => m.skills || []);
    const allSpecialties = members.flatMap(m => m.specialties || []);
    
    const stats = {
        members: {
            total: members.length,
            active: members.filter(m => m.isActive !== false).length,
            withSpecialties: members.filter(m => m.specialties && m.specialties.length > 0).length,
            withSkills: members.filter(m => m.skills && m.skills.length > 0).length,
            withBoth: members.filter(m => 
                m.specialties && m.specialties.length > 0 && 
                m.skills && m.skills.length > 0
            ).length,
            withProjects: members.filter(m => m.projects && m.projects.trim() !== '').length,
            byOrganization: Object.groupBy(members, m => m.organization || 'Non renseigné')
        },
        projects: {
            total: projects.length,
            byStatus: Object.groupBy(projects, p => p.status || 'idea'),
            averageMembersPerProject: projects.length > 0 ? 
                (projects.reduce((sum, p) => sum + (p.members?.length || 0), 0) / projects.length).toFixed(1) : 0
        },
        groups: {
            total: groups.length,
            byType: Object.groupBy(groups, g => g.type || 'technique'),
            averageMembersPerGroup: groups.length > 0 ? 
                (groups.reduce((sum, g) => sum + (g.members?.length || 0), 0) / groups.length).toFixed(1) : 0,
            autoCreated: groups.filter(g => g.autoCreated).length
        },
        skills: {
            totalUnique: [...new Set(allSkills)].length,
            mostCommon: getMostCommonItems(allSkills, 10),
            totalOccurrences: allSkills.length
        },
        specialties: {
            totalUnique: [...new Set(allSpecialties)].length,
            mostCommon: getMostCommonItems(allSpecialties, 10),
            totalOccurrences: allSpecialties.length
        },
        synergyAnalyses: {
            total: synergyAnalyses.length,
            aiEnhanced: synergyAnalyses.filter(a => a.aiEnhanced).length,
            recent: synergyAnalyses.filter(a => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(a.createdAt) > weekAgo;
            }).length,
            averageSynergiesPerAnalysis: synergyAnalyses.length > 0 ? 
                (synergyAnalyses.reduce((sum, a) => sum + (a.synergyScores?.total || 0), 0) / synergyAnalyses.length).toFixed(1) : 0,
            totalSynergiesAnalyzed: synergyAnalyses.reduce((sum, a) => sum + (a.synergyScores?.total || 0), 0)
        },
        global: {
            totalCollections: 8, // membres, projets, groupes, analyses, compétences, spécialités, interactions, synergy_analyses
            lastUpdate: new Date().toISOString(),
            dataQuality: {
                membersWithCompleteProfile: members.filter(m => 
                    m.name && m.email && m.specialties?.length > 0 && m.skills?.length > 0
                ).length,
                projectsWithMembers: projects.filter(p => p.members?.length > 0).length,
                savedAnalyses: synergyAnalyses.length
            }
        }
    };
    
    return stats;
};

// 🔹 VALIDATION DES DONNÉES CRITIQUES
const validateCriticalData = (members, projects) => {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(members)) {
        errors.push("Les membres doivent être un tableau");
    }
    
    if (!Array.isArray(projects)) {
        errors.push("Les projets doivent être un tableau");
    }
    
    // Vérifier la cohérence des références
    const allMemberIds = new Set(members.map(m => m._id));
    const projectsWithInvalidMembers = projects.filter(project => 
        project.members && project.members.some(memberId => !allMemberIds.has(memberId))
    );
    
    if (projectsWithInvalidMembers.length > 0) {
        warnings.push(`${projectsWithInvalidMembers.length} projets avec des références de membres invalides`);
    }
    
    // Vérifier les données manquantes critiques
    const membersWithoutName = members.filter(m => !m.name || m.name === 'Nom non renseigné');
    if (membersWithoutName.length > 0) {
        warnings.push(`${membersWithoutName.length} membres sans nom valide`);
    }
    
    return { errors, warnings };
};

// 🔹 CORRECTION ET VALIDATION URL PHOTO
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

    // Validation URL
    try {
        new URL(photoUrl);
        return photoUrl; // URL absolue valide
    } catch {
        // URL relative, la retourner telle quelle
        return photoUrl;
    }
};

// 🔹 GESTION DE LA PAGINATION
const getPaginationParams = (req) => {
    const query = req.query || {};
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 0)); // 0 = pas de limite
    const skip = (page - 1) * limit;
    
    return { page, limit, skip, hasPagination: limit > 0 };
};

// 🔹 FONCTION DE SAUVEGARDE DES ANALYSES DE SYNERGIE
const saveSynergyAnalysis = async (db, analysisData) => {
    try {
        const analysisCollection = db.collection('synergy_analyses');
        
        // Validation des données requises
        if (!analysisData.type || !analysisData.title) {
            throw new Error("Données d'analyse incomplètes: type et titre requis");
        }

        const analysisDocument = {
            type: analysisData.type,
            title: analysisData.title,
            description: analysisData.description || 'Analyse de synergies professionnelles',
            analysisData: analysisData.analysisData || {},
            statistics: analysisData.statistics || {},
            timestamp: new Date(),
            status: 'completed',
            aiEnhanced: analysisData.statistics?.aiEnhanced || false,
            membersInvolved: analysisData.statistics?.totalMembers || 0,
            synergyScores: {
                average: analysisData.analysisData?.synergies?.reduce((acc, s) => acc + (s.score || 0), 0) / (analysisData.analysisData?.synergies?.length || 1) || 0,
                highPotential: analysisData.statistics?.highPotentialSynergies || 0,
                total: analysisData.statistics?.totalSynergies || 0
            },
            recommendations: analysisData.analysisData?.projectOpportunities || [],
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                version: analysisData.metadata?.version || '2.0.0',
                aiModel: analysisData.statistics?.aiModel || 'algorithmic',
                processingTime: analysisData.statistics?.processingTime || 0,
                source: analysisData.metadata?.source || 'appwrite_function',
                deepAnalysis: analysisData.metadata?.deepAnalysis || false,
                membersAnalyzed: analysisData.metadata?.membersAnalyzed || 0
            }
        };

        const result = await analysisCollection.insertOne(analysisDocument);
        console.log(`✅ Analyse de synergie sauvegardée: ${result.insertedId}`, {
            synergies: analysisDocument.synergyScores.total,
            aiEnhanced: analysisDocument.aiEnhanced,
            members: analysisDocument.membersInvolved
        });
        
        return {
            success: true,
            analysisId: result.insertedId,
            timestamp: analysisDocument.timestamp,
            synergies: analysisDocument.synergyScores.total
        };
    } catch (error) {
        console.error('❌ Erreur sauvegarde analyse:', error);
        throw error;
    }
};

// 🔹 FONCTION PRINCIPALE OPTIMISÉE
export default async function handler({ req, res, log, error }) {
    log("🚀 Fonction Appwrite lancée : get-matrice - VERSION COMPLÈTE SYNERGIES");

    // 🔹 VÉRIFICATION DU CACHE
    const useCache = req.query?.cache !== 'false';
    if (useCache && cache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        log("✅ Retour des données en cache");
        return res.json({
            ...cache,
            metadata: {
                ...cache.metadata,
                cached: true,
                cacheAge: Math.round((Date.now() - cacheTimestamp) / 1000)
            }
        });
    }

    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";

    if (!MONGO_URI) {
        const msg = "❌ Variable MONGODB_URI manquante !";
        error(msg);
        return res.json({
            success: false,
            message: msg,
            timestamp: new Date().toISOString()
        });
    }

    let client;

    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        log(`✅ Connecté à MongoDB - Base: ${DB_NAME}`);

        const db = client.db(DB_NAME);

        // 🔹 GESTION DES REQUÊTES DE SAUVEGARDE
        if (req.method === 'POST' && req.path === '/api/v1/synergy-analysis') {
            log("💾 Requête de sauvegarde d'analyse reçue");
            
            try {
                let analysisData;
                if (typeof req.body === 'string') {
                    analysisData = JSON.parse(req.body);
                } else if (req.body && typeof req.body === 'object') {
                    analysisData = req.body;
                } else {
                    throw new Error("Format de données invalide");
                }

                log("📊 Données analyse reçues:", {
                    type: analysisData.type,
                    title: analysisData.title,
                    synergies: analysisData.analysisData?.synergies?.length,
                    aiEnhanced: analysisData.statistics?.aiEnhanced
                });

                const result = await saveSynergyAnalysis(db, analysisData);
                
                return res.json({
                    success: true,
                    message: "Analyse sauvegardée avec succès dans MongoDB Atlas",
                    ...result,
                    timestamp: new Date().toISOString()
                });
            } catch (saveError) {
                error("❌ Erreur sauvegarde analyse:", saveError);
                return res.json({
                    success: false,
                    message: "Erreur lors de la sauvegarde de l'analyse",
                    error: saveError.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 🔹 GESTION DE LA PAGINATION
        const { limit, skip, hasPagination } = getPaginationParams(req);
        
        // 🔹 RÉCUPÉRATION DE TOUTES LES COLLECTIONS AVEC PROJECTION
        log("📥 Récupération de toutes les collections avec projection...");

        const collectionPromises = {
            members: db.collection('members')
                .find({}, collectionConfig.members)
                .skip(hasPagination ? skip : 0)
                .limit(hasPagination ? limit : 0)
                .toArray(),
            
            projects: db.collection('projects')
                .find({}, collectionConfig.projects)
                .sort({ createdAt: -1 })
                .skip(hasPagination ? skip : 0)
                .limit(hasPagination ? limit : 0)
                .toArray(),
            
            groups: db.collection('groups')
                .find({}, collectionConfig.groups)
                .skip(hasPagination ? skip : 0)
                .limit(hasPagination ? limit : 0)
                .toArray(),
            
            analyses: db.collection('analyses')
                .find({}, collectionConfig.analyses)
                .sort({ createdAt: -1 })
                .skip(hasPagination ? skip : 0)
                .limit(hasPagination ? limit : 0)
                .toArray(),
            
            skills: db.collection('skills')
                .find({}, collectionConfig.skills)
                .toArray(),
            
            specialties: db.collection('specialties')
                .find({}, collectionConfig.specialties)
                .toArray(),
            
            interactions: db.collection('interactions')
                .find({}, collectionConfig.interactions)
                .sort({ createdAt: -1 })
                .skip(hasPagination ? skip : 0)
                .limit(hasPagination ? limit : 0)
                .toArray(),
            
            synergy_analyses: db.collection('synergy_analyses')
                .find({}, collectionConfig.synergy_analyses)
                .sort({ createdAt: -1 })
                .limit(50) // Limiter aux 50 dernières analyses
                .toArray()
        };

        // 🔹 EXÉCUTION PARALLÈLE AVEC GESTION D'ERREUR
        const results = await Promise.allSettled(Object.values(collectionPromises));

        // 🔹 EXTRACTION DES DONNÉES AVEC GESTION D'ERREUR
        const members = handleCollectionError(results[0], 'members', log, error, []);
        const projects = handleCollectionError(results[1], 'projects', log, error, []);
        const groups = handleCollectionError(results[2], 'groups', log, error, []);
        const analyses = handleCollectionError(results[3], 'analyses', log, error, []);
        const skills = handleCollectionError(results[4], 'skills', log, error, []);
        const specialties = handleCollectionError(results[5], 'specialties', log, error, []);
        const interactions = handleCollectionError(results[6], 'interactions', log, error, []);
        const synergyAnalyses = handleCollectionError(results[7], 'synergy_analyses', log, error, []);

        // 🔹 VALIDATION DES DONNÉES CRITIQUES
        const validation = validateCriticalData(members, projects);
        if (validation.errors.length > 0) {
            error(`❌ Erreurs de validation: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            log(`⚠️ Avertissements: ${validation.warnings.join(', ')}`);
        }

        log(`✅ Données brutes récupérées: ${members.length} membres, ${projects.length} projets, ${synergyAnalyses.length} analyses sauvegardées`);

        // 🔹 FORMATAGE OPTIMISÉ DES MEMBRES
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

        // 🔹 FORMATAGE DES PROJETS
        const formattedProjects = formatCollection(projects, (project) => {
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
            memberCount: group.members ? group.members.length : 0,
            autoCreated: group.autoCreated || false,
            creationType: group.creationType || 'manual'
        }), 'groupes');

        // 🔹 FORMATAGE DES ANALYSES DE SYNERGIE
        const formattedSynergyAnalyses = formatCollection(synergyAnalyses, (analysis) => ({
            _id: analysis._id?.toString(),
            type: analysis.type || 'professional_synergy_analysis',
            title: analysis.title || 'Analyse de synergies',
            description: analysis.description || '',
            analysisData: analysis.analysisData || {},
            statistics: analysis.statistics || {},
            timestamp: analysis.timestamp || analysis.createdAt,
            status: analysis.status || 'completed',
            aiEnhanced: analysis.aiEnhanced || false,
            membersInvolved: analysis.membersInvolved || 0,
            synergyScores: analysis.synergyScores || {},
            recommendations: analysis.recommendations || [],
            createdAt: analysis.createdAt || new Date(),
            updatedAt: analysis.updatedAt || new Date(),
            metadata: analysis.metadata || {}
        }), 'analyses_de_synergie');

        // 🔹 FORMATAGE DES AUTRES COLLECTIONS
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

        const formattedSkills = formatCollection(skills, (skill) => ({
            _id: skill._id?.toString(),
            name: skill.name || '',
            category: skill.category || 'technique',
            description: skill.description || '',
            memberCount: skill.memberCount || 0
        }), 'compétences');

        const formattedSpecialties = formatCollection(specialties, (specialty) => ({
            _id: specialty._id?.toString(),
            name: specialty.name || '',
            category: specialty.category || 'technique',
            description: specialty.description || '',
            memberCount: specialty.memberCount || 0
        }), 'spécialités');

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

        // 🔹 CALCUL DES STATISTIQUES AVANCÉES
        const enhancedStats = calculateEnhancedStats(
            formattedMembers, 
            formattedProjects, 
            formattedGroups,
            formattedSkills,
            formattedSpecialties,
            formattedSynergyAnalyses
        );

        await client.close();
        log("✅ Connexion MongoDB fermée");

        // 🔹 PRÉPARATION DE LA RÉPONSE COMPLÈTE
        const responseData = {
            success: true,
            timestamp: new Date().toISOString(),

            // Format principal pour compatibilité
            projects: formattedProjects,
            members: formattedMembers,

            // Structure complète organisée
            data: {
                members: formattedMembers,
                projects: formattedProjects,
                groups: formattedGroups,
                analyses: formattedAnalyses,
                skills: formattedSkills,
                specialties: formattedSpecialties,
                interactions: formattedInteractions,
                synergyAnalyses: formattedSynergyAnalyses // Nouvelle collection
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
                    interactions: formattedInteractions.length,
                    synergyAnalyses: formattedSynergyAnalyses.length
                },
                statistics: enhancedStats,
                pagination: hasPagination ? { limit, skip } : null,
                validation: {
                    errors: validation.errors,
                    warnings: validation.warnings
                },
                performance: {
                    cached: false,
                    fromCache: false,
                    processingTime: Date.now() - (cacheTimestamp || Date.now())
                },
                database: DB_NAME,
                version: '3.1.0',
                features: {
                    synergyAnalysis: true,
                    aiIntegration: true,
                    realTimeUpdates: true,
                    advancedStatistics: true
                }
            },
            
            message: `Données chargées avec succès: ${formattedMembers.length} membres, ${formattedProjects.length} projets, ${formattedSynergyAnalyses.length} analyses sauvegardées`
        };

        // 🔹 MISE EN CACHE
        if (useCache) {
            cache = responseData;
            cacheTimestamp = Date.now();
            log("✅ Données mises en cache pour 5 minutes");
        }

        log(`✅ Réponse préparée: ${formattedMembers.length} membres, ${formattedProjects.length} projets, ${formattedSynergyAnalyses.length} analyses`);
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
            timestamp: new Date().toISOString(),
            fallbackData: {
                members: [],
                projects: [],
                groups: [],
                synergyAnalyses: []
            }
        });
    }
}

// 🔹 FONCTION DE SAUVEGARDE DIRECTE POUR TESTS
export const saveSynergyAnalysisDirect = async (analysisData) => {
    const MONGO_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.MONGODB_DB_NAME || "matrice";
    
    if (!MONGO_URI) {
        throw new Error("MONGODB_URI manquante");
    }

    let client;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        
        return await saveSynergyAnalysis(db, analysisData);
    } finally {
        if (client) {
            await client.close();
        }
    }
};
