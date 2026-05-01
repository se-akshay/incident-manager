const mongoose = require("mongoose");

const aiResultSchema = new mongoose.Schema({
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Incident",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["summary", "next_action", "priority_review"],
    default: "summary",
  },
  result_text: {
    type: String,
    required: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("AIResult", aiResultSchema);
