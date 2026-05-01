# Incident Dashboard Backend

Simple backend for the take-home assignment using:

- Node.js + Express (REST API)
- Socket.IO (real-time updates)
- MongoDB + Mongoose

## Features Implemented

- Incident dashboard APIs
- Create incident API
- Real-time incident updates via Socket.IO
- Status workflow: `open`, `investigating`, `resolved`
- AI assist endpoint using Gemini API with rule-based fallback
- Validation + basic error handling

## Setup

1. Install MongoDB locally (or use MongoDB Atlas).
2. Copy `.env.example` to `.env` and update values.
3. Run:

```bash
npm install
npm run dev
```

## Seed Demo Data

Run the seed script to insert sample incidents, updates, and AI results:

```bash
npm run seed
```

Note: this script clears existing incident-related data before inserting fresh demo records.

Server starts on `http://localhost:4000` by default.

## Environment Variables

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/incident_dashboard
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

## REST API

Base URL: `/api/incidents`

- `GET /api/incidents`
  - List all incidents
- `POST /api/incidents`
  - Create a new incident
  - Body:
    ```json
    {
      "title": "Payment API failing",
      "description": "Multiple users cannot complete checkout",
      "priority": "high",
      "reporter_name": "Akshay"
    }
    ```
- `GET /api/incidents/:id`
  - Get single incident with updates + AI results
- `PATCH /api/incidents/:id/status`
  - Update status
  - Body:
    ```json
    { "status": "investigating" }
    ```
- `GET /api/incidents/:id/updates`
  - Get updates for an incident
- `POST /api/incidents/:id/updates`
  - Add an update
  - Body:
    ```json
    {
      "message": "Rollback started",
      "author_name": "On-call Engineer"
    }
    ```
- `POST /api/incidents/:id/ai/assist`
  - Generate AI output with Gemini
  - Body:
    ```json
    { "type": "summary" }
    ```
  - `type` supports: `summary`, `next_action`, `priority_review`

## Socket.IO

### Client -> Server

- `incident:join` with payload `incidentId`
  - Joins room `incident:<incidentId>`

### Server -> Client

- `incident:created`
  - Broadcast when a new incident is created
- `incident:updated`
  - Broadcast when an incident status/latest update changes
- `incident:update-added`
  - Emitted to incident room when a new update is posted

## Notes on AI Integration

The endpoint `POST /api/incidents/:id/ai/assist` now calls Gemini first.

If Gemini is unavailable or `GEMINI_API_KEY` is empty, it falls back to the built-in rule-based logic so your app still works.
