/**
 * Script d'import des membres dans MongoDB
 * ----------------------------------------
 * À exécuter avec :
 *    node backend/seed/importMembers.js
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Member from "../models/Member.js"; // Assure-toi que le modèle existe

dotenv.config();

const __dirname = path.resolve(); // Pour résoudre les chemins sur Windows
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/matrice_profils";

// Connexion MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connecté à MongoDB"))
  .catch(err => {
    console.error("❌ Erreur de connexion :", err);
    process.exit(1);
  });

async function importMembers() {
  try {
    // Lecture du fichier JSON
    const filePath = path.join(__dirname, "members_template_examples.json");
    const rawData = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(rawData);

    // Transformer specialties et skills en tableaux
    data.forEach(m => {
      if (typeof m.specialties === "string") {
        m.specialties = m.specialties.split(",").map(s => s.trim());
      }
      if (typeof m.skills === "string") {
        m.skills = m.skills.split(",").map(s => s.trim());
      }
    });

    // Suppression préalable (optionnelle)
    await Member.deleteMany({});
    console.log("🧹 Collection 'members' vidée.");

    // Insertion des données
    await Member.insertMany(data);
    console.log(`✅ ${data.length} membres importés avec succès !`);

  } catch (error) {
    console.error("❌ Erreur lors de l'import :", error);
  } finally {
    mongoose.connection.close();
  }
}

importMembers();
