// functions/get-matrice-complete/src/index.js - VERSION AVEC RELATIONS
import { MongoClient } from "mongodb";

export default async function handler({ req, res, log, error }) {
  log("🚀 Fonction Appwrite lancée : get-matrice-complete");

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
    
    // Récupérer toutes les collections
    const [members, projects, groups, analyses, skills, specialties, interactions] = await Promise.all([
      db.collection('members').find({}).toArray(),
      db.collection('projects').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('groups').find({}).toArray(),
      db.collection('analyses').find({}).sort({ createdAt: -1 }).limit(20).toArray(),
      db.collection('skills').find({}).toArray(),
      db.collection('specialties').find({}).toArray(),
      db.collection('interactions').find({}).sort({ createdAt: -1 }).limit(50).toArray()
    ]);

    // Créer des maps pour les relations
    const memberMap = new Map(members.map(m => [m._id.toString(), m]));
    const projectMap = new Map(projects.map(p => [p._id.toString(), p]));
    const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

    // Formater les projets avec les membres populés
    const projectsWithMembers = projects.map(project => ({
      ...project,
      _id: project._id.toString(),
      members: (project.members || []).map(memberId => {
        const member = memberMap.get(memberId?.toString());
        return member ? {
          _id: member._id.toString(),
          name: member.name,
          email: member.email,
          title: member.title,
          organization: member.organization
        } : { _id: memberId?.toString(), name: 'Membre inconnu' };
      })
    }));

    // Formater les groupes avec les membres populés
    const groupsWithMembers = groups.map(group => ({
      ...group,
      _id: group._id.toString(),
      members: (group.members || []).map(memberId => {
        const member = memberMap.get(memberId?.toString());
        return member ? {
          _id: member._id.toString(),
          name: member.name,
          email: member.email
        } : { _id: memberId?.toString(), name: 'Membre inconnu' };
      }),
      leader: group.leader ? {
        _id: group.leader.toString(),
        name: memberMap.get(group.leader.toString())?.name || 'Leader inconnu'
      } : null
    }));

    await client.close();

    return res.json({
      success: true,
      projects: projectsWithMembers,
      members: members.map(m => ({
        ...m,
        _id: m._id.toString()
      })),
      groups: groupsWithMembers,
      analyses: analyses.map(a => ({
        ...a,
        _id: a._id.toString()
      })),
      skills: skills.map(s => ({
        ...s,
        _id: s._id.toString()
      })),
      specialties: specialties.map(s => ({
        ...s,
        _id: s._id.toString()
      })),
      interactions: interactions.map(i => ({
        ...i,
        _id: i._id.toString()
      })),
      totals: {
        members: members.length,
        projects: projects.length,
        groups: groups.length,
        analyses: analyses.length,
        skills: skills.length,
        specialties: specialties.length,
        interactions: interactions.length
      },
      message: "Données complètes chargées avec relations"
    });

  } catch (err) {
    error("❌ Erreur: " + err.message);
    if (client) await client.close();
    return res.json({ 
      success: false, 
      message: err.message
    });
  }
}
