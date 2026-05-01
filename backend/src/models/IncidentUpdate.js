const mongoose = require("mongoose");

const incidentUpdateSchema = new mongoose.Schema({
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Incident",
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  author_name: {
    type: String,
    required: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("IncidentUpdate", incidentUpdateSchema);
