require("dotenv").config();

const mongoose = require("mongoose");
const { connectDB } = require("./config/db");
const Incident = require("./models/Incident");
const IncidentUpdate = require("./models/IncidentUpdate");
const AIResult = require("./models/AIResult");

async function seed() {
  await connectDB();

  // Reset collections so every run gives a consistent demo dataset.
  await Promise.all([
    AIResult.deleteMany({}),
    IncidentUpdate.deleteMany({}),
    Incident.deleteMany({}),
  ]);

  const incidents = await Incident.insertMany([
    {
      title: "Payment API failing for some users",
      description: "Checkout requests timing out from mobile app traffic.",
      priority: "high",
      status: "investigating",
      reporter_name: "Nisha",
      latest_update: "Rollback initiated for payment-service v2.4.1.",
    },
    {
      title: "Customer unable to upload document",
      description: "PDF uploads fail with 413 error in onboarding flow.",
      priority: "medium",
      status: "open",
      reporter_name: "Rahul",
      latest_update: "Issue reproduced with files larger than 8MB.",
    },
    {
      title: "Dashboard not loading for priority client",
      description: "UI spins forever after login for enterprise tenant.",
      priority: "critical",
      status: "open",
      reporter_name: "Asha",
      latest_update: "Possible auth token validation issue under review.",
    },
    {
      title: "Login errors started 10 minutes ago",
      description: "Spike in 401 responses for users from EU region.",
      priority: "high",
      status: "resolved",
      reporter_name: "Ibrahim",
      latest_update: "Expired signing key rotated, error rate back to normal.",
    },
  ]);

  const incidentByTitle = Object.fromEntries(
    incidents.map((incident) => [incident.title, incident]),
  );

  await IncidentUpdate.insertMany([
    {
      incident_id: incidentByTitle["Payment API failing for some users"]._id,
      message: "Error rate crossed 12% on checkout endpoints.",
      author_name: "On-call Backend",
    },
    {
      incident_id: incidentByTitle["Payment API failing for some users"]._id,
      message: "Rollback initiated for payment-service v2.4.1.",
      author_name: "Release Manager",
    },
    {
      incident_id: incidentByTitle["Customer unable to upload document"]._id,
      message: "Issue reproduced with files larger than 8MB.",
      author_name: "QA Engineer",
    },
    {
      incident_id:
        incidentByTitle["Dashboard not loading for priority client"]._id,
      message: "Tenant config fetch API is timing out after 30 seconds.",
      author_name: "Frontend Lead",
    },
    {
      incident_id: incidentByTitle["Login errors started 10 minutes ago"]._id,
      message: "Expired signing key rotated, error rate back to normal.",
      author_name: "Security Engineer",
    },
  ]);

  await AIResult.insertMany([
    {
      incident_id: incidentByTitle["Payment API failing for some users"]._id,
      type: "next_action",
      result_text:
        "1) Monitor rollback completion and checkout success rate. 2) Keep customer support informed every 10 minutes. 3) Pause further deployments until stability is confirmed.",
    },
    {
      incident_id:
        incidentByTitle["Dashboard not loading for priority client"]._id,
      type: "summary",
      result_text:
        "Critical dashboard outage is impacting an enterprise tenant. Initial investigation points to tenant config API timeouts after login, and team is actively isolating root cause.",
    },
    {
      incident_id: incidentByTitle["Login errors started 10 minutes ago"]._id,
      type: "priority_review",
      result_text:
        "Priority can be reduced from high now that signing key rotation restored service and errors normalized. Keep incident open briefly for post-fix verification before full closure.",
    },
  ]);

  console.log(`Seed complete. Created ${incidents.length} incidents.`);
}

seed()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await mongoose.connection.close();
    process.exit(1);
  });
