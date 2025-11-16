// backend/src/function/index.js

module.exports = async function handler(req, res) {
  console.log("Fonction exécutée !");
  res.status(200).json({ message: "Fonction prête" });
};

