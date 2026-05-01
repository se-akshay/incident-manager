import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const API_INCIDENTS = `${API_BASE}/api/incidents`;

const statusOptions = ["open", "investigating", "resolved"];
const priorityOptions = ["low", "medium", "high", "critical"];
const aiTypeOptions = ["summary", "next_action", "priority_review"];

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function App() {
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);

  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");

  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    reporter_name: "",
  });
  const [newUpdate, setNewUpdate] = useState("");
  const [updateAuthor, setUpdateAuthor] = useState("");
  const [aiType, setAiType] = useState("summary");

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedId) || null,
    [incidents, selectedId],
  );

  async function fetchIncidents() {
    setListLoading(true);
    setListError("");
    try {
      const response = await fetch(API_INCIDENTS);
      if (!response.ok) throw new Error("Failed to fetch incidents");
      const payload = await response.json();
      const items = payload?.data || [];
      setIncidents(items);
      if (!selectedId && items.length) {
        setSelectedId(items[0].id);
      }
    } catch (error) {
      setListError(error.message || "Unable to load incidents.");
    } finally {
      setListLoading(false);
    }
  }

  async function fetchIncidentDetail(incidentId) {
    if (!incidentId) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_INCIDENTS}/${incidentId}`);
      if (!response.ok) throw new Error("Failed to fetch incident details");
      const payload = await response.json();
      setDetail(payload?.data || null);
    } catch (error) {
      setListError(error.message || "Unable to load incident details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreateIncident(event) {
    event.preventDefault();
    setFormError("");

    if (
      !createForm.title.trim() ||
      !createForm.description.trim() ||
      !createForm.reporter_name.trim()
    ) {
      setFormError("Title, description, and reporter name are required.");
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch(API_INCIDENTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!response.ok) throw new Error("Failed to create incident");
      const payload = await response.json();
      const created = payload?.data;
      if (created) {
        setSelectedId(created.id);
      }
      setCreateForm({
        title: "",
        description: "",
        priority: "medium",
        reporter_name: "",
      });
    } catch (error) {
      setFormError(error.message || "Could not create incident.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedId) return;
    setStatusLoading(true);
    try {
      const response = await fetch(`${API_INCIDENTS}/${selectedId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      await fetchIncidentDetail(selectedId);
    } catch (error) {
      setListError(error.message || "Could not update status.");
    } finally {
      setStatusLoading(false);
    }
  }

  async function handlePostUpdate(event) {
    event.preventDefault();
    setFormError("");
    if (!selectedId) return;

    if (!newUpdate.trim() || !updateAuthor.trim()) {
      setFormError("Update message and author name are required.");
      return;
    }

    setUpdateLoading(true);
    try {
      const response = await fetch(`${API_INCIDENTS}/${selectedId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newUpdate, author_name: updateAuthor }),
      });
      if (!response.ok) throw new Error("Failed to post update");
      setNewUpdate("");
      await fetchIncidentDetail(selectedId);
    } catch (error) {
      setFormError(error.message || "Could not post update.");
    } finally {
      setUpdateLoading(false);
    }
  }

  async function handleAiAssist(event) {
    event.preventDefault();
    if (!selectedId) return;
    setAiLoading(true);
    try {
      const response = await fetch(`${API_INCIDENTS}/${selectedId}/ai/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: aiType }),
      });
      if (!response.ok) throw new Error("Failed to generate AI output");
      await fetchIncidentDetail(selectedId);
    } catch (error) {
      setListError(error.message || "Could not run AI assist.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    fetchIncidentDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const socket = io(API_BASE);

    socket.on("connect", () => {
      if (selectedId) {
        socket.emit("incident:join", selectedId);
      }
    });

    socket.on("incident:created", (incident) => {
      setIncidents((current) => {
        const exists = current.some((item) => item.id === incident.id);
        if (exists) return current;
        return [incident, ...current];
      });
    });

    socket.on("incident:updated", (incident) => {
      setIncidents((current) =>
        current
          .map((item) => (item.id === incident.id ? incident : item))
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
      );

      if (selectedId && incident.id === selectedId) {
        setDetail((current) =>
          current
            ? {
                ...current,
                ...incident,
              }
            : current,
        );
      }
    });

    socket.on("incident:update-added", (update) => {
      if (selectedId && update.incident_id === selectedId) {
        setDetail((current) => {
          if (!current) return current;
          return {
            ...current,
            updates: [update, ...(current.updates || [])],
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedId]);

  return (
    <div className="min-h-screen w-full bg-(--bg) text-(--text)">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="glass-panel animate-rise mb-6 rounded-2xl p-6">
          <p className="text-xs font-semibold tracking-[0.24em] text-(--muted) uppercase">
            Real-Time AI Incident Room
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Incident Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-(--muted)">
            Create incidents, post live updates, and request AI suggestions from
            Gemini.
          </p>
        </header>

        {listError ? (
          <div className="mb-4 rounded-xl border border-rose-300/40 bg-rose-100/50 px-4 py-3 text-sm text-rose-900">
            {listError}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <div className="glass-panel animate-rise rounded-2xl p-5 [animation-delay:80ms]">
              <h2 className="text-lg font-semibold">Create Incident</h2>
              <form className="mt-4 grid gap-3" onSubmit={handleCreateIncident}>
                <input
                  className="field"
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Incident title"
                />
                <textarea
                  className="field min-h-24"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe the issue"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="field"
                    value={createForm.priority}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  >
                    {priorityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    value={createForm.reporter_name}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        reporter_name: event.target.value,
                      }))
                    }
                    placeholder="Reporter name"
                  />
                </div>
                {formError ? (
                  <p className="text-sm text-rose-700">{formError}</p>
                ) : null}
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={createLoading}
                >
                  {createLoading ? "Creating..." : "Create Incident"}
                </button>
              </form>
            </div>

            <div className="glass-panel animate-rise rounded-2xl p-5 [animation-delay:120ms]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Incident List</h2>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={fetchIncidents}
                >
                  Refresh
                </button>
              </div>

              {listLoading ? (
                <p className="mt-4 text-sm text-(--muted)">
                  Loading incidents...
                </p>
              ) : incidents.length === 0 ? (
                <p className="mt-4 text-sm text-(--muted)">
                  No incidents yet. Create one above.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {incidents.map((incident) => (
                    <li key={incident.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(incident.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          selectedId === incident.id
                            ? "border-(--accent) bg-(--accent)/12"
                            : "border-black/10 bg-white/55 hover:bg-white/75"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{incident.title}</p>
                            <p className="mt-1 text-xs text-(--muted)">
                              {incident.status} | {incident.priority}
                            </p>
                          </div>
                          <span className="text-xs text-(--muted)">
                            {formatDate(incident.updated_at)}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="glass-panel animate-rise rounded-2xl p-5 [animation-delay:160ms]">
            <h2 className="text-lg font-semibold">Incident Details</h2>
            {!selectedIncident ? (
              <p className="mt-4 text-sm text-(--muted)">
                Select an incident to view details and post updates.
              </p>
            ) : detailLoading && !detail ? (
              <p className="mt-4 text-sm text-(--muted)">
                Loading details...
              </p>
            ) : (
              <>
                <div className="mt-4 rounded-xl border border-black/10 bg-white/55 p-4">
                  <h3 className="text-xl font-semibold">{detail?.title}</h3>
                  <p className="mt-2 text-sm text-(--muted)">
                    {detail?.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="tag">Status: {detail?.status}</span>
                    <span className="tag">Priority: {detail?.priority}</span>
                    <span className="tag">
                      Reporter: {detail?.reporter_name}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-(--muted)">
                    Updated: {formatDate(detail?.updated_at)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={statusLoading}
                        onClick={() => handleStatusChange(option)}
                        className={`btn-secondary ${
                          detail?.status === option
                            ? "ring-2 ring-(--accent)"
                            : ""
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <form className="mt-5 grid gap-3" onSubmit={handlePostUpdate}>
                  <h4 className="font-semibold">Post Live Update</h4>
                  <textarea
                    className="field min-h-24"
                    value={newUpdate}
                    onChange={(event) => setNewUpdate(event.target.value)}
                    placeholder="What happened just now?"
                  />
                  <input
                    className="field"
                    value={updateAuthor}
                    onChange={(event) => setUpdateAuthor(event.target.value)}
                    placeholder="Author name"
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={updateLoading}
                  >
                    {updateLoading ? "Posting..." : "Post Update"}
                  </button>
                </form>

                <form className="mt-5 grid gap-3" onSubmit={handleAiAssist}>
                  <h4 className="font-semibold">AI Assist</h4>
                  <select
                    className="field"
                    value={aiType}
                    onChange={(event) => setAiType(event.target.value)}
                  >
                    {aiTypeOptions.map((option) => (
                      <option value={option} key={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={aiLoading}
                  >
                    {aiLoading ? "Generating..." : "Generate AI Output"}
                  </button>
                </form>

                <div className="mt-5 grid gap-3">
                  <h4 className="font-semibold">Live Updates</h4>
                  {(detail?.updates || []).length === 0 ? (
                    <p className="text-sm text-(--muted)">
                      No updates yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.updates.map((update) => (
                        <li
                          key={update._id}
                          className="rounded-lg border border-black/10 bg-white/60 p-3"
                        >
                          <p className="text-sm">{update.message}</p>
                          <p className="mt-1 text-xs text-(--muted)">
                            {update.author_name} |{" "}
                            {formatDate(update.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-5 grid gap-3">
                  <h4 className="font-semibold">AI Results</h4>
                  {(detail?.ai_results || []).length === 0 ? (
                    <p className="text-sm text-(--muted)">
                      No AI results yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.ai_results.map((item) => (
                        <li
                          key={item._id}
                          className="rounded-lg border border-black/10 bg-white/60 p-3"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-(--muted)">
                            {item.type}
                          </p>
                          <p className="mt-1 text-sm whitespace-pre-wrap">
                            {item.result_text}
                          </p>
                          <p className="mt-1 text-xs text-(--muted)">
                            {formatDate(item.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;

