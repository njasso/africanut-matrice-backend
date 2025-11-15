const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InteractionSchema = new Schema({
  type: {
    type: String,
    enum: [
      'message', 
      'match_request', 
      'mentorship', 
      'project_invite', 
      'external_request',
      'collaboration',
      'expertise_share',
      'project_review',
      'strategic_meeting',
      'knowledge_transfer',
      // 💡 AJOUT : Types pour les suggestions de l'IA et le monitoring
      'collaboration_suggested', 
      'project_suggested', 
      'internal_monitoring'
    ],
    required: true,
    comment: 'Type d\'interaction'
  },
  title: {
    type: String,
    required: true, // 🚨 Ce champ doit être fourni dans la requête POST
    comment: 'Titre de l\'interaction'
  },
  description: {
    type: String,
    comment: 'Description détaillée'
  },
  // Référence unique pour l'initiateur
  from: { 
    type: Schema.Types.ObjectId, 
    ref: 'Member', 
    required: true // 🚨 Ce champ doit être fourni dans la requête POST
  },
  // Références multiples pour les destinataires (Member B dans l'analyse)
  to: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Member' 
  }],
  // Références aux projets concernés
  projects: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Project' 
  }],
  // Références aux groupes concernés
  groups: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Group' 
  }],
  // Références aux spécialités concernées
  specialties: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Specialty' 
  }],
  
  // NOUVEAUX CHAMPS (existant mais mis à jour pour clarté)
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'canceled'],
    default: 'pending',
    comment: 'Statut de l\'interaction ou de la suggestion'
  },
  category: {
    type: String,
    enum: ['personal', 'project', 'group', 'strategic', 'ai_suggestion', 'manual'], // 💡 AJOUT: ai_suggestion
    default: 'manual'
  },
  // Métadonnées pour l'analyse IA
  ai_analysis: {
    strategic_value: Number,
    recommended_actions: [String],
    risk_level: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    success_probability: Number,
    last_analyzed: Date
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour optimiser les recherches
InteractionSchema.index({ from: 1 });
InteractionSchema.index({ to: 1 });
InteractionSchema.index({ status: 1 });
InteractionSchema.index({ category: 1 });
InteractionSchema.index({ 'payload.priority': 1 });
InteractionSchema.index({ 'ai_analysis.strategic_value': -1 });
InteractionSchema.index({ createdAt: -1 });

// Virtual pour le nombre total de participants
InteractionSchema.virtual('participantCount').get(function() {
  // L'initiateur ('from') est toujours là (1), plus les destinataires ('to')
  return 1 + (this.to ? this.to.length : 0); 
});

// Méthode pour marquer comme analysé par l'IA
InteractionSchema.methods.markAsAnalyzed = function(analysisData) {
  this.ai_analysis = {
    ...analysisData,
    last_analyzed: new Date()
  };
  return this.save();
};

// Méthode statique pour les interactions stratégiques
InteractionSchema.statics.getStrategicInteractions = function() {
  return this.find({ 
    category: 'strategic',
    status: { $in: ['pending', 'accepted'] } 
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Interaction', InteractionSchema);