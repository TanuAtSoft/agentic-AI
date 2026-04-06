import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const initialForm = {
  companyName: "Stripe",
  industry: "Fintech / SaaS",
  companySize: "5000+",
  geography: "North America"
};

function renderList(items) {
  if (!items?.length) {
    return <p className="empty-state">No data available.</p>;
  }

  return (
    <ul className="pill-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [openaiDebug, setOpenaiDebug] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const refreshOpenAIDebug = async () => {
    try {
      const response = await fetch(`${API_BASE}/debug/openai`);
      const data = await response.json();
      setOpenaiDebug(data);
    } catch (_err) {
      setOpenaiDebug(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Failed to run lead pipeline");
      }

      const data = await response.json();
      setResult(data);
      await refreshOpenAIDebug();
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const searchStrategy = result?.searchStrategy;
  const personalizedMessage = result?.personalizedMessage;
  const legacyMessage = personalizedMessage?.message;
  const emailMessage = personalizedMessage?.email || legacyMessage || "";
  const linkedinMessage =
    personalizedMessage?.linkedinMessage ||
    "LinkedIn variant unavailable in this response shape.";
  const callOpener =
    personalizedMessage?.callOpener || "Call opener unavailable in this response shape.";
  const subjectLine =
    personalizedMessage?.subjectLine ||
    (result?.company?.name ? `${result.company.name} growth idea` : "Generated outreach");

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Agentic lead research POC</p>
          <h1>Turn a company input into buyer research, signals, and outreach.</h1>
          <p className="subtitle">
            This prototype decides where to look, infers likely stakeholders, synthesizes public
            signals, and drafts context-aware outbound messaging.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>Inputs</span>
            <strong>Company, industry, size, geography</strong>
          </div>
          <div className="metric-card">
            <span>Outputs</span>
            <strong>Decision-makers, signals, messaging</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <form onSubmit={handleSubmit} className="panel composer-panel">
          <div className="panel-heading">
            <p className="eyebrow">1. Configure account</p>
            <h2>Target company brief</h2>
          </div>

          <label>
            <span>Company name</span>
            <input
              required
              name="companyName"
              placeholder="Company name"
              value={form.companyName}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Industry</span>
            <input
              name="industry"
              placeholder="Industry"
              value={form.industry}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Company size</span>
            <input
              name="companySize"
              placeholder="Company size"
              value={form.companySize}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Geography</span>
            <input
              name="geography"
              placeholder="Geography"
              value={form.geography}
              onChange={handleChange}
            />
          </label>

          <div className="button-row">
            <button type="submit" disabled={loading}>
              {loading ? "Running pipeline..." : "Generate intelligence"}
            </button>
            <button type="button" className="secondary-button" onClick={refreshOpenAIDebug}>
              Check model status
            </button>
          </div>

          <div className="hint-box">
            <strong>What the POC does:</strong>
            <p>
              Plans search surfaces, reads public company context, scores likely buying signals,
              and creates outreach for email, LinkedIn, and call prep.
            </p>
          </div>

          {error ? <p className="error">Error: {error}</p> : null}
        </form>

        <section className="results-column">
          <div className="panel summary-panel">
            <div className="panel-heading">
              <p className="eyebrow">2. Search strategy</p>
              <h2>System reasoning</h2>
            </div>

            {result ? (
              <>
                <p className="summary-line">
                  <strong>Persona focus:</strong>{" "}
                  {searchStrategy?.primaryPersonaFocus || "Commercial and operations leadership"}
                </p>
                <p className="summary-line">
                  <strong>Intent:</strong>{" "}
                  {searchStrategy?.searchIntent ||
                    "Find likely decision-makers, gather context, detect signals, and draft outreach."}
                </p>
                <div className="source-list">
                  {(searchStrategy?.sourcePlan || [
                    {
                      name: "Company website",
                      purpose: "Use public website content as the primary research source.",
                      status: "active"
                    },
                    {
                      name: "LinkedIn public footprint",
                      purpose: "Infer likely stakeholders and public messaging themes.",
                      status: "planned"
                    }
                  ]).map((source) => (
                    <article key={source.name} className="source-card">
                      <div className="source-topline">
                        <h3>{source.name}</h3>
                        <span className={`status-chip ${source.status}`}>{source.status}</span>
                      </div>
                      <p>{source.purpose}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-state">
                Run the pipeline to see which sources and signal categories the system prioritized.
              </p>
            )}
          </div>

          {result ? (
            <>
              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">3. Account snapshot</p>
                  <h2>{result.company.name}</h2>
                </div>
                <div className="stats-grid">
                  <div>
                    <span>Website</span>
                    <strong>{result.company.website}</strong>
                  </div>
                  <div>
                    <span>Industry</span>
                    <strong>{result.company.industry}</strong>
                  </div>
                  <div>
                    <span>Company size</span>
                    <strong>{result.company.companySize}</strong>
                  </div>
                  <div>
                    <span>Geography</span>
                    <strong>{result.company.geography}</strong>
                  </div>
                </div>
                <p className="body-copy">{result.company.websiteSummary.description || "No public company description detected."}</p>
                {renderList(result.company.websiteSummary.keywords)}
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">4. Likely decision-makers</p>
                  <h2>Buyer candidates</h2>
                </div>
                <div className="decision-maker-grid">
                  {result.decisionMakers.map((person) => (
                    <article key={`${person.name}-${person.title}`} className="decision-card">
                      <p className="decision-name">{person.name}</p>
                      <p className="decision-title">{person.title}</p>
                      <p>{person.whyRelevant}</p>
                      <p className="muted-text">Recent signal: {person.recentPost}</p>
                      <p className="muted-text">
                        Confidence: {person.confidence} | Source: {person.source}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">5. Signals and analysis</p>
                  <h2>Why this account matters now</h2>
                </div>
                <div className="stats-grid compact">
                  <div>
                    <span>Priority</span>
                    <strong>{result.insights?.accountPriority || "High"}</strong>
                  </div>
                  <div>
                    <span>Freshness</span>
                    <strong>{result.companySignals?.dataFreshness || "Heuristic"}</strong>
                  </div>
                  <div>
                    <span>Hiring detected</span>
                    <strong>{String(result.companySignals?.hiring)}</strong>
                  </div>
                  <div>
                    <span>Best channels</span>
                    <strong>{(result.insights?.bestChannels || ["Email"]).join(", ")}</strong>
                  </div>
                </div>
                <p className="body-copy">
                  <strong>Outreach angle:</strong> {result.insights?.outreachAngle}
                </p>
                <p className="body-copy">
                  <strong>Signal summary:</strong>{" "}
                  {result.insights?.signalSummary || "Signals synthesized from the current account context."}
                </p>
                {renderList(result.insights?.keyReasons)}
                <div className="signal-columns">
                  <div>
                    <h3>Open roles</h3>
                    {renderList(result.companySignals?.openRoles)}
                  </div>
                  <div>
                    <h3>Growth keywords</h3>
                    {renderList(result.companySignals?.growthKeywords)}
                  </div>
                  <div>
                    <h3>Tech keywords</h3>
                    {renderList(result.companySignals?.techKeywords)}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">6. Outreach output</p>
                  <h2>Personalized messaging</h2>
                </div>
                <div className="message-block">
                  <span>Subject line</span>
                  <p>{subjectLine}</p>
                </div>
                <div className="message-block">
                  <span>Email</span>
                  <p>{emailMessage}</p>
                </div>
                <div className="message-grid">
                  <div className="message-block">
                    <span>LinkedIn message</span>
                    <p>{linkedinMessage}</p>
                  </div>
                  <div className="message-block">
                    <span>Call opener</span>
                    <p>{callOpener}</p>
                  </div>
                </div>
                <p className="muted-text">
                  Model: {personalizedMessage?.model} | {personalizedMessage?.note}
                </p>
              </div>
            </>
          ) : null}

          <div className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Runtime</p>
              <h2>OpenAI diagnostics</h2>
            </div>
            {openaiDebug ? (
              <div className="stats-grid compact">
                <div>
                  <span>Configured</span>
                  <strong>{String(openaiDebug.openaiConfigured)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{openaiDebug.diagnostics?.lastStatus || "unknown"}</strong>
                </div>
                <div>
                  <span>Attempts</span>
                  <strong>{openaiDebug.diagnostics?.totalAttempts || 0}</strong>
                </div>
                <div>
                  <span>Fallbacks</span>
                  <strong>{openaiDebug.diagnostics?.fallbackCount || 0}</strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">Use "Check model status" to inspect the backend runtime.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
