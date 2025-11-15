// models/Group.js
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ["technique", "sectoriel", "recherche", "management", "autre"],
    default: "technique"
  },
  privacy: {
    type: String,
    enum: ["public", "private"],
    default: "public"
  },
  tags: [{
    type: String,
    trim: true
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member"
  }],
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member"
  },
  autoCreated: {
    type: Boolean,
    default: false
  },
  creationType: {
    type: String,
    enum: ["manual", "byTitle", "byOrganization"],
    default: "manual"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Group", groupSchema);