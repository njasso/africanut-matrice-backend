import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
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
    enum: ["byTitle", "byOrganization", "manual"],
    default: "manual"
  }
}, {
  timestamps: true
});

// Index pour les recherches
groupSchema.index({ name: 'text', description: 'text', tags: 'text' });
groupSchema.index({ type: 1 });
groupSchema.index({ privacy: 1 });

export default mongoose.model("Group", groupSchema);
