const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
  title: String,
  description: String,
  members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
  status: { type: String, enum: ['idea','active','completed','archived'], default: 'idea' },
  organization: String,
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema); // 🔹 Export correct

