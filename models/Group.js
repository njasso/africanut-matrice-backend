import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Le nom du groupe est obligatoire"],
    trim: true,
    maxlength: [100, "Le nom ne peut pas dépasser 100 caractères"],
    index: true
  },
  description: {
    type: String,
    required: [true, "La description est obligatoire"],
    trim: true,
    maxlength: [500, "La description ne peut pas dépasser 500 caractères"]
  },
  type: {
    type: String,
    enum: {
      values: ["technique", "sectoriel", "recherche", "management", "autre"],
      message: "Le type doit être: technique, sectoriel, recherche, management ou autre"
    },
    default: "technique",
    index: true
  },
  privacy: {
    type: String,
    enum: {
      values: ["public", "private"],
      message: "La confidentialité doit être: public ou private"
    },
    default: "public",
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, "Un tag ne peut pas dépasser 50 caractères"]
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    index: true
  }],
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    validate: {
      validator: function(v) {
        if (!v) return true; // Leader optionnel
        return this.members.includes(v);
      },
      message: "Le leader doit être membre du groupe"
    }
  },
  autoCreated: {
    type: Boolean,
    default: false
  },
  creationType: {
    type: String,
    enum: ["byTitle", "byOrganization", "manual"],
    default: "manual"
  },
  status: {
    type: String,
    enum: ["active", "archived", "suspended"],
    default: "active",
    index: true
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member"
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual pour le comptage des membres
groupSchema.virtual('memberCount').get(function() {
  return this.members ? this.members.length : 0;
});

// Middleware pour mettre à jour memberCount
groupSchema.pre('save', function(next) {
  this.metadata.memberCount = this.members ? this.members.length : 0;
  this.metadata.lastActivity = new Date();
  next();
});

// Index composés pour les performances
groupSchema.index({ type: 1, privacy: 1, status: 1 });
groupSchema.index({ "metadata.lastActivity": -1 });
groupSchema.index({ tags: 1 });
groupSchema.index({ name: "text", description: "text" });

// Méthode statique pour trouver les groupes actifs
groupSchema.statics.findActive = function() {
  return this.find({ status: "active" }).populate('members leader', 'name email organization title');
};

// Méthode statique pour les groupes par type
groupSchema.statics.findByType = function(type) {
  return this.find({ type, status: "active" }).populate('members', 'name email');
};

// Méthode d'instance pour ajouter un membre
groupSchema.methods.addMember = function(memberId) {
  if (!this.members.includes(memberId)) {
    this.members.push(memberId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Méthode d'instance pour retirer un membre
groupSchema.methods.removeMember = function(memberId) {
  this.members = this.members.filter(id => !id.equals(memberId));
  return this.save();
};

// Méthode d'instance pour vérifier si un membre est dans le groupe
groupSchema.methods.hasMember = function(memberId) {
  return this.members.some(id => id.equals(memberId));
};

// Middleware pour nettoyer les tags avant sauvegarde
groupSchema.pre('save', function(next) {
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = this.tags
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index); // Supprimer les doublons
  }
  next();
});

export default mongoose.model("Group", groupSchema);
