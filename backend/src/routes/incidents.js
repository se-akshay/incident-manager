const express = require("express");
const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const IncidentUpdate = require("../models/IncidentUpdate");
const AIResult = require("../models/AIResult");

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toApiIncident(incidentDoc) {
  return {
    id: incidentDoc._id,
    title: incidentDoc.title,
    description: incidentDoc.description,
    priority: incidentDoc.priority,
    status: incidentDoc.status,
    reporter_name: incidentDoc.reporter_name,
    latest_update: incidentDoc.latest_update,
    created_at: incidentDoc.created_at,
    updated_at: incidentDoc.updated_at,
  };
}

function buildFallbackAIText(type, incident, updates) {
  const latest = updates[0]
    ? updates[0].message
    : incident.latest_update || "No updates yet.";

  if (type === "next_action") {
    if (incident.priority === "critical" || incident.priority === "high") {
      return "Notify on-call lead immediately, assign a single incident owner, and post updates every 10 minutes until stabilized.";
    }

    if (incident.status === "resolved") {
      return "Confirm user impact is fully cleared, then close this incident and create a short post-incident note.";
    }

    return "Assign owner, verify scope of impact, and share a progress update in the incident thread within 15 minutes.";
  }

  if (type === "priority_review") {
    if (incident.priority === "critical") {
      return "Priority looks correct as CRITICAL because rapid coordination is required.";
    }

    if (incident.priority === "low" && incident.status !== "resolved") {
      return "Consider upgrading to MEDIUM if multiple users are impacted or the issue is ongoing.";
    }

    return "Current priority appears reasonable based on available details.";
  }

  return `Incident '${incident.title}' is currently ${incident.status}. Priority is ${incident.priority}. Latest update: ${latest}`;
}

function buildGeminiPrompt(type, incident, updates) {
  const updateLines = updates
    .map(
      (u, index) =>
        `${index + 1}. [${new Date(u.created_at).toISOString()}] ${u.author_name}: ${u.message}`,
    )
    .join("\n");

  const taskByType = {
    summary:
      "Write a concise incident summary in 2-3 sentences for engineering and support stakeholders.",
    next_action:
      "Suggest the top 3 next actions as short bullet points for the incident commander.",
    priority_review:
      "Review current priority and suggest whether to keep or change it with a one-paragraph justification.",
  };

  return [
    "You are an incident response assistant.",
    taskByType[type] || taskByType.summary,
    "Keep output practical and specific.",
    "",
    `Incident Title: ${incident.title}`,
    `Description: ${incident.description}`,
    `Priority: ${incident.priority}`,
    `Status: ${incident.status}`,
    `Reporter: ${incident.reporter_name}`,
    `Latest Update: ${incident.latest_update || "N/A"}`,
    "Recent Updates:",
    updateLines || "No updates provided.",
  ].join("\n");
}

async function generateWithGemini(type, incident, updates) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = buildGeminiPrompt(type, incident, updates);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    ?.trim();

  if (!text) {
    throw new Error("Gemini API returned an empty response.");
  }

  return text;
}

router.get("/", async (req, res, next) => {
  try {
    const incidents = await Incident.find().sort({ updated_at: -1 });
    res.json({ data: incidents.map(toApiIncident) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, description, priority, reporter_name } = req.body;

    if (!title || !description || !reporter_name) {
      return res.status(400).json({
        error: "title, description, and reporter_name are required.",
      });
    }

    const incident = await Incident.create({
      title,
      description,
      priority,
      reporter_name,
      latest_update: description,
    });

    const io = req.app.get("io");
    io.emit("incident:created", toApiIncident(incident));

    res.status(201).json({ data: toApiIncident(incident) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid incident id." });
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const [updates, aiResults] = await Promise.all([
      IncidentUpdate.find({ incident_id: id }).sort({ created_at: -1 }),
      AIResult.find({ incident_id: id }).sort({ created_at: -1 }),
    ]);

    res.json({
      data: {
        ...toApiIncident(incident),
        updates,
        ai_results: aiResults,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid incident id." });
    }

    if (!["open", "investigating", "resolved"].includes(status)) {
      return res.status(400).json({
        error: "status must be one of: open, investigating, resolved.",
      });
    }

    const incident = await Incident.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );

    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const io = req.app.get("io");
    io.emit("incident:updated", toApiIncident(incident));

    res.json({ data: toApiIncident(incident) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/updates", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid incident id." });
    }

    const updates = await IncidentUpdate.find({ incident_id: id }).sort({
      created_at: -1,
    });

    res.json({ data: updates });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/updates", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, author_name } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid incident id." });
    }

    if (!message || !author_name) {
      return res
        .status(400)
        .json({ error: "message and author_name are required." });
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const update = await IncidentUpdate.create({
      incident_id: id,
      message,
      author_name,
    });

    incident.latest_update = message;
    await incident.save();

    const io = req.app.get("io");
    io.to(`incident:${id}`).emit("incident:update-added", update);
    io.emit("incident:updated", toApiIncident(incident));

    res.status(201).json({ data: update });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/ai/assist", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type = "summary" } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid incident id." });
    }

    if (!["summary", "next_action", "priority_review"].includes(type)) {
      return res.status(400).json({
        error: "type must be one of: summary, next_action, priority_review.",
      });
    }

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const updates = await IncidentUpdate.find({ incident_id: id })
      .sort({ created_at: -1 })
      .limit(5);

    let resultText;
    try {
      resultText = await generateWithGemini(type, incident, updates);
    } catch (geminiError) {
      console.error(geminiError);
    }

    if (!resultText) {
      resultText = buildFallbackAIText(type, incident, updates);
    }

    const aiResult = await AIResult.create({
      incident_id: id,
      type,
      result_text: resultText,
    });

    res.status(201).json({ data: aiResult });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
