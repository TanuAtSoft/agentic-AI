import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const initialForm = {
  companyName: "Stripe",
  industry: "Fintech / SaaS",
  companySize: "5000+",
  geography: "North America"
};

const workflowSteps = [
  {
    id: "search",
    title: "Decide where to search",
    description: "Choose company site, web, backend LinkedIn scraping, Indeed hiring, Crunchbase funding, and regional sources based on the account."
  },
  {
    id: "buyers",
    title: "Identify decision-makers",
    description: "Find the most relevant leaders and explain why each one matters."
  },
  {
    id: "signals",
    title: "Gather and analyze signals",
    description: "Pull hiring, growth, backend LinkedIn, Indeed, Crunchbase, regional, and messaging clues into a single view."
  },
  {
    id: "outreach",
    title: "Generate outreach",
    description: "Craft personalized email, LinkedIn, and call-opening copy from the synthesized context."
  }
];

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

function renderTextList(items) {
  if (!items?.length) {
    return <p className="empty-state">No data available.</p>;
  }

  return (
    <ul className="detail-list">
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
  const [connectorDebug, setConnectorDebug] = useState(null);
  const [apifyDebug, setApifyDebug] = useState(null);
  const [apifyLoading, setApifyLoading] = useState(false);
  const [apifyError, setApifyError] = useState("");

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

  const refreshConnectorDebug = async () => {
    try {
      const response = await fetch(`${API_BASE}/debug/connectors`);
      const data = await response.json();
      setConnectorDebug(data);
    } catch (_err) {
      setConnectorDebug(null);
    }
  };

  const runApifySoftprodigyTest = async () => {
    setApifyError("");
    setApifyLoading(true);

    try {
      const response = await fetch(`${API_BASE}/debug/apify/softprodigy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to run Apify test");
      }

      setApifyDebug(data);
      await refreshConnectorDebug();
    } catch (err) {
      setApifyDebug(null);
      setApifyError(err.message || "Unknown error");
    } finally {
      setApifyLoading(false);
    }
  };

  useEffect(() => {
    refreshOpenAIDebug();
    refreshConnectorDebug();
  }, []);

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
      await refreshConnectorDebug();
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const searchStrategy = result?.searchStrategy;
  const company = result?.company;
  const hybridSignals = result?.hybridSignals;
  const linkedinSignals = hybridSignals?.linkedin;
  const indeedSignals = hybridSignals?.indeed;
  const crunchbaseSignals = hybridSignals?.crunchbase;
  const companySignals = result?.companySignals;
  const icpCriteria = result?.icpCriteria;
  const companyFootprint = result?.companyFootprint;
  const hunterIntelligence = result?.hunterIntelligence;
  const insights = result?.insights;
  const personalizedMessage = result?.personalizedMessage;
  const executionSummary = result?.executionSummary;

  const emailMessage = personalizedMessage?.email || personalizedMessage?.message || "";
  const linkedinMessage =
    personalizedMessage?.linkedinMessage ||
    "LinkedIn variant unavailable in this response shape.";
  const callOpener =
    personalizedMessage?.callOpener || "Call opener unavailable in this response shape.";
  const subjectLine =
    personalizedMessage?.subjectLine ||
    (company?.name ? `${company.name} growth idea` : "Generated outreach");
  const linkedinIntentSignals = linkedinSignals?.intentSignals || [];
  const indeedHiringSignals = indeedSignals?.hiringIntentSignals || [];
  const crunchbaseFundingSignals = crunchbaseSignals?.fundingIntentSignals || [];

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Agentic GTM research console</p>
          <h1>From one company input to a complete outbound brief.</h1>
          <p className="subtitle">
            Give the system a company, industry, size, and geography. It decides where to search,
            optionally pulls LinkedIn, Indeed, and Crunchbase signals through server-side scraping
            APIs in the backend, identifies likely buyers, selects relevant signals, synthesizes
            insights, and crafts context-aware outreach.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>System does</span>
            <strong>Research planning, buyer discovery, signal analysis, and messaging</strong>
          </div>
          <div className="metric-card">
            <span>Powered by</span>
            <strong>Website context, OpenAI synthesis, and structured output cards</strong>
          </div>
        </div>
      </section>

      <section className="workflow-strip">
        {workflowSteps.map((step, index) => (
          <article key={step.id} className={`workflow-card ${result ? "active" : ""}`}>
            <span className="workflow-index">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <form onSubmit={handleSubmit} className="panel composer-panel">
          <div className="panel-heading">
            <p className="eyebrow">Input</p>
            <h2>Company brief</h2>
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
              {loading ? "Running agent..." : "Generate outbound brief"}
            </button>
            <button type="button" className="secondary-button" onClick={refreshOpenAIDebug}>
              Refresh diagnostics
            </button>
          </div>

          <div className="hint-box">
            <strong>Expected output</strong>
            <p>
              Decision-makers, company and individual insights, relevant signals, recommended
              channels, and hyper-personalized messaging tied to the account context.
            </p>
          </div>

          {error ? <p className="error">Error: {error}</p> : null}
        </form>

        <section className="results-column">
          <div className="panel orchestration-panel">
            <div className="panel-heading">
              <p className="eyebrow">System orchestration</p>
              <h2>Where the agent looked and why</h2>
            </div>

            {result ? (
              <>
                <div className="stats-grid compact">
                  <div>
                    <span>Persona focus</span>
                    <strong>
                      {searchStrategy?.primaryPersonaFocus || "Commercial and operations leadership"}
                    </strong>
                  </div>
                  <div>
                    <span>Intent</span>
                    <strong>{searchStrategy?.searchIntent || "Generate account intelligence"}</strong>
                  </div>
                  <div>
                    <span>Generated</span>
                    <strong>{new Date(result.generatedAt).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Freshness</span>
                    <strong>{companySignals?.dataFreshness || "Heuristic"}</strong>
                  </div>
                </div>
                <div className="source-list">
                  {(searchStrategy?.sourcePlan || []).map((source) => (
                    <article key={source.name} className="source-card">
                      <div className="source-topline">
                        <h3>{source.name}</h3>
                        <span className={`status-chip ${source.status}`}>{source.status}</span>
                      </div>
                      <p>{source.purpose}</p>
                    </article>
                  ))}
                </div>
                <div className="dual-panel">
                  <div>
                    <h3>Signal checklist</h3>
                    {renderTextList(searchStrategy?.signalChecklist)}
                  </div>
                  <div>
                    <h3>Sources used</h3>
                    {renderTextList(executionSummary?.sourcesUsed)}
                  </div>
                </div>
              </>
            ) : (
              <p className="empty-state">
                Run the pipeline to see how the system chooses LinkedIn, web, company-site, and
                regional search surfaces for the account.
              </p>
            )}
          </div>

          {result ? (
            <>
              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Account context</p>
                  <h2>{company?.name}</h2>
                </div>
                <div className="stats-grid">
                  <div>
                    <span>Website</span>
                    <strong>{company?.website}</strong>
                  </div>
                  <div>
                    <span>Industry</span>
                    <strong>{company?.industry}</strong>
                  </div>
                  <div>
                    <span>Company size</span>
                    <strong>{company?.companySize}</strong>
                  </div>
                  <div>
                    <span>Geography</span>
                    <strong>{company?.geography}</strong>
                  </div>
                </div>
                <p className="body-copy">
                  {company?.websiteSummary?.description || "No public company description detected."}
                </p>
                <div className="dual-panel">
                  <div>
                    <h3>Website title</h3>
                    <p className="body-copy">{company?.websiteSummary?.title || "Not available"}</p>
                  </div>
                  <div>
                    <h3>Detected themes</h3>
                    {renderList(company?.websiteSummary?.keywords)}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Decision-makers</p>
                  <h2>Who to reach out to</h2>
                </div>
                <div className="decision-maker-grid">
                  {(result.decisionMakers || []).map((person) => (
                  <article key={`${person.name}-${person.title}`} className="decision-card">
                    <div className="decision-header">
                      <p className="decision-name">{person.name}</p>
                      <span className={`confidence-chip ${person.confidence || "medium"}`}>
                        {person.confidence || "medium"}
                        </span>
                    </div>
                    <p className="decision-title">{person.title}</p>
                    <p>{person.whyRelevant}</p>
                    <p className="muted-text">
                      Email: {person.email || "Hunter did not return a match for this person yet."}
                    </p>
                    {person.hunterMatch ? (
                      <p className="muted-text">
                        Hunter match: {person.hunterMatch.name} · {person.hunterMatch.title} ·{" "}
                        {person.hunterMatch.confidence} confidence
                      </p>
                    ) : null}
                    <p className="muted-text">Recent post: {person.recentPost}</p>
                    <p className="muted-text">Source: {person.source}</p>
                    <a className="profile-link" href={person.profileUrl} target="_blank" rel="noreferrer">
                      View profile
                    </a>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Hunter.io</p>
                  <h2>Domain-based decision maker emails</h2>
                </div>
                {hunterIntelligence ? (
                  <>
                    <div className="stats-grid compact">
                      <div>
                        <span>Domain</span>
                        <strong>{hunterIntelligence.domain || company?.website}</strong>
                      </div>
                      <div>
                        <span>Organization</span>
                        <strong>{hunterIntelligence.organization || company?.name}</strong>
                      </div>
                      <div>
                        <span>Contacts</span>
                        <strong>{hunterIntelligence.totalContacts || 0}</strong>
                      </div>
                      <div>
                        <span>Decision makers</span>
                        <strong>{hunterIntelligence.totalDecisionMakers || 0}</strong>
                      </div>
                    </div>
                    <p className="caption">
                      Pattern: {hunterIntelligence.pattern || "Unavailable"} | Source:{" "}
                      {hunterIntelligence.source || "hunter-domain-search"}
                    </p>
                    <div className="hunter-subsection">
                      <h3>Decision maker emails</h3>
                      <div className="hunter-email-list">
                        {(hunterIntelligence.decisionMakerEmails || []).length ? (
                          hunterIntelligence.decisionMakerEmails.map((contact) => (
                            <article key={contact.email} className="hunter-email-card">
                              <div className="source-topline">
                                <h3>{contact.name}</h3>
                                <span
                                  className={`status-chip ${
                                    contact.verificationStatus === "valid" ? "active" : "planned"
                                  }`}
                                >
                                  {contact.confidence || 0}
                                </span>
                              </div>
                              <p className="decision-title">{contact.title || "Unknown title"}</p>
                              <p className="muted-text">Email: {contact.email}</p>
                              <p className="muted-text">
                                Verification: {contact.verificationStatus || "unverified"}
                              </p>
                              {contact.linkedinUrl ? (
                                <a
                                  className="profile-link"
                                  href={contact.linkedinUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View LinkedIn
                                </a>
                              ) : null}
                            </article>
                          ))
                        ) : (
                          <p className="empty-state">
                            No decision maker emails were returned by Hunter for this search.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="hunter-contact-list">
                      {(hunterIntelligence.decisionMakerContacts || []).length ? (
                        <div className="hunter-subsection">
                          <h3>Decision maker matches</h3>
                          <div className="decision-maker-grid">
                            {hunterIntelligence.decisionMakerContacts.map((contact) => (
                              <article key={contact.email} className="decision-card">
                                <div className="decision-header">
                                  <p className="decision-name">{contact.name}</p>
                                  <span className="confidence-chip high">
                                    {contact.confidence || 0}
                                  </span>
                                </div>
                                <p className="decision-title">{contact.title || "Unknown title"}</p>
                                <p className="muted-text">Email: {contact.email}</p>
                                <p className="muted-text">
                                  Seniority: {contact.seniority || "n/a"} | Department:{" "}
                                  {contact.department || "n/a"}
                                </p>
                                <p className="muted-text">
                                  Verification: {contact.verificationStatus || "unverified"}
                                </p>
                                {contact.sources?.length ? (
                                  <div className="hunter-sources">
                                    <span className="source-label">Sources</span>
                                    <ul className="detail-list">
                                      {contact.sources.map((source) => (
                                        <li key={`${contact.email}-${source.uri}`}>
                                          <strong>{source.domain}</strong>: {source.uri}
                                          <span className="source-meta">
                                            {" "}
                                            ({source.last_seen_on || "unknown"} | extracted{" "}
                                            {source.extracted_on || "unknown"})
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="hunter-subsection">
                        <h3>All discovered contacts</h3>
                        <div className="hunter-table">
                          {(hunterIntelligence.contacts || []).map((contact) => (
                            <article key={contact.email} className="hunter-contact-card">
                              <div className="source-topline">
                                <h3>{contact.name}</h3>
                                <span className={`status-chip ${contact.verificationStatus === "valid" ? "active" : "planned"}`}>
                                  {contact.confidence || 0}
                                </span>
                              </div>
                              <p className="decision-title">{contact.title || "Unknown title"}</p>
                              <div className="hunter-contact-stats">
                                <div>
                                  <span>Email</span>
                                  <strong>{contact.email}</strong>
                                </div>
                                <div>
                                  <span>Seniority</span>
                                  <strong>{contact.seniority || "n/a"}</strong>
                                </div>
                                <div>
                                  <span>Department</span>
                                  <strong>{contact.department || "n/a"}</strong>
                                </div>
                                <div>
                                  <span>Verification</span>
                                  <strong>{contact.verificationStatus || "unverified"}</strong>
                                </div>
                              </div>
                              <p className="muted-text">
                                LinkedIn: {contact.linkedinUrl || "Unavailable"}
                              </p>
                              <p className="muted-text">
                                Twitter: {contact.twitter || "Unavailable"} | Phone:{" "}
                                {contact.phoneNumber || "Unavailable"}
                              </p>
                              {contact.sources?.length ? (
                                <div className="hunter-sources">
                                  <span className="source-label">Sources</span>
                                  <ul className="detail-list">
                                    {contact.sources.map((source) => (
                                      <li key={`${contact.email}-${source.uri}`}>
                                        <strong>{source.domain}</strong>: {source.uri}
                                        <span className="source-meta">
                                          {" "}
                                          ({source.last_seen_on || "unknown"} | still on page:{" "}
                                          {String(source.still_on_page)})
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="empty-state">
                    Hunter is not configured yet. Add `HUNTER_API_KEY` to the backend env, restart,
                    and run the search again to populate domain-based decision maker emails.
                  </p>
                )}
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Insights and signals</p>
                  <h2>Why this account matters now</h2>
                </div>
                <div className="stats-grid compact">
                  <div>
                    <span>Priority</span>
                    <strong>{insights?.accountPriority || "High"}</strong>
                  </div>
                  <div>
                    <span>Hiring</span>
                    <strong>{String(companySignals?.hiring)}</strong>
                  </div>
                  <div>
                    <span>Best channels</span>
                    <strong>{(insights?.bestChannels || ["Email"]).join(", ")}</strong>
                  </div>
                  <div>
                    <span>Recommendation</span>
                    <strong>{insights?.recommendation || "Use low-friction CTA"}</strong>
                  </div>
                </div>
                <div className="analysis-banner">
                  <span>Outreach angle</span>
                  <p>{insights?.outreachAngle}</p>
                </div>
                <p className="body-copy">
                  <strong>Signal summary:</strong>{" "}
                  {insights?.signalSummary || "Signals synthesized from the current account context."}
                </p>
                <div className="dual-panel">
                  <div>
                    <h3>Key reasons</h3>
                    {renderTextList(insights?.keyReasons)}
                  </div>
                  <div>
                    <h3>Messaging signals</h3>
                    {renderTextList(companySignals?.messagingSignals)}
                  </div>
                </div>
                <div className="signal-columns">
                  <div>
                    <h3>Hiring signals</h3>
                    {renderList(companySignals?.openRoles)}
                    <p className="caption">{companySignals?.hiringTrend}</p>
                  </div>
                  <div>
                    <h3>Growth signals</h3>
                    {renderTextList(companySignals?.growthSignals)}
                  </div>
                  <div>
                    <h3>Technology cues</h3>
                    {renderList(companySignals?.techKeywords)}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Hybrid signals and ICP</p>
                  <h2>LinkedIn, Indeed, Crunchbase, and target segments</h2>
                </div>
                <div className="dual-panel">
                  <div>
                    <h3>LinkedIn intent signals</h3>
                    {linkedinIntentSignals.length ? (
                      <ul className="detail-list">
                        {linkedinIntentSignals.map((signal) => (
                          <li key={signal.label}>
                            <strong>{signal.label}</strong>: {signal.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-state">No LinkedIn API data was returned for this account.</p>
                    )}
                    <p className="caption">
                      Source: {linkedinSignals?.source || "unavailable"} | Provider:{" "}
                      {linkedinSignals?.provider || "n/a"}
                    </p>
                  </div>
                  <div>
                    <h3>Indeed hiring trends</h3>
                    {indeedHiringSignals.length ? (
                      <ul className="detail-list">
                        {indeedHiringSignals.map((signal) => (
                          <li key={signal.label}>
                            <strong>{signal.label}</strong>: {signal.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-state">No Indeed hiring data was returned for this account.</p>
                    )}
                    <p className="caption">
                      Source: {indeedSignals?.source || "unavailable"} | Provider:{" "}
                      {indeedSignals?.provider || "n/a"}
                    </p>
                  </div>
                </div>
                <div className="dual-panel">
                  <div>
                    <h3>Crunchbase funding signals</h3>
                    {crunchbaseFundingSignals.length ? (
                      <ul className="detail-list">
                        {crunchbaseFundingSignals.map((signal) => (
                          <li key={signal.label}>
                            <strong>{signal.label}</strong>: {signal.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-state">No Crunchbase funding data was returned for this account.</p>
                    )}
                    <p className="caption">
                      Source: {crunchbaseSignals?.source || "unavailable"} | Provider:{" "}
                      {crunchbaseSignals?.provider || "n/a"}
                    </p>
                  </div>
                  <div>
                    <h3>Finalized ICP</h3>
                    <p className="body-copy">
                      {icpCriteria?.finalizedICP?.buyingMotion || "ICP summary unavailable."}
                    </p>
                    {renderTextList(icpCriteria?.finalizedICP?.keyFilters)}
                  </div>
                </div>
                <div className="dual-panel">
                  <div>
                    <h3>Target segments</h3>
                    <div className="source-list">
                      {(icpCriteria?.targetSegments || []).map((segment) => (
                        <article key={segment.name} className="source-card">
                          <div className="source-topline">
                            <h3>{segment.name}</h3>
                            <span className={`status-chip ${segment.priority}`}>
                              {segment.priority}
                            </span>
                          </div>
                          <p>{segment.fit}</p>
                          <p className="muted-text">
                            Functions: {segment.targetFunctions.join(", ")}
                          </p>
                          <p className="muted-text">
                            Triggers: {segment.triggerSignals.join(", ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Regional footprint</h3>
                    <div className="stats-grid compact">
                      <div>
                        <span>HQ hypothesis</span>
                        <strong>{companyFootprint?.headquartersHypothesis || "Unknown"}</strong>
                      </div>
                      <div>
                        <span>Regions detected</span>
                        <strong>{(companyFootprint?.currentRegions || []).join(", ") || "Unknown"}</strong>
                      </div>
                    </div>
                    <div className="source-list">
                      {(companyFootprint?.marketFootprint || []).map((region) => (
                        <article key={region.region} className="source-card">
                          <div className="source-topline">
                            <h3>{region.region}</h3>
                            <span className={`status-chip ${region.status}`}>{region.status}</span>
                          </div>
                          <p className="muted-text">Confidence: {region.confidence}</p>
                          <p>{(region.evidence || []).join(" | ")}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Outreach</p>
                  <h2>Hyper-personalized messaging</h2>
                </div>
                <div className="message-stack">
                  <div className="message-block featured-message">
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
                </div>
                <p className="muted-text">
                  Model: {personalizedMessage?.model} | {personalizedMessage?.note}
                </p>
              </div>
            </>
          ) : null}

          <div className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Diagnostics</p>
              <h2>Runtime health</h2>
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
                  <span>Successes</span>
                  <strong>{openaiDebug.diagnostics?.successCount || 0}</strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">Use "Refresh diagnostics" to inspect backend runtime health.</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-heading">
              <p className="eyebrow">Connectors</p>
              <h2>Hybrid integration status</h2>
            </div>
            {connectorDebug ? (
                <div className="stats-grid compact">
                  <div>
                    <span>Apify</span>
                    <strong>{String(connectorDebug.apifyConfigured)}</strong>
                  </div>
                  <div>
                    <span>Hunter API</span>
                    <strong>{String(connectorDebug.hunterConfigured)}</strong>
                  </div>
                  <div>
                    <span>LinkedIn API</span>
                    <strong>{String(connectorDebug.linkedinScraperConfigured)}</strong>
                  </div>
                  <div>
                    <span>Indeed API</span>
                    <strong>{String(connectorDebug.indeedScraperConfigured)}</strong>
                  </div>
                  <div>
                    <span>Crunchbase API</span>
                    <strong>{String(connectorDebug.crunchbaseScraperConfigured)}</strong>
                  </div>
                  <div>
                    <span>OpenAI</span>
                    <strong>{String(connectorDebug.openaiConfigured)}</strong>
                  </div>
                  <div>
                    <span>LinkedIn mode</span>
                    <strong>{connectorDebug.linkedinScraperMode || "server-side"}</strong>
                  </div>
                  <div>
                    <span>Indeed mode</span>
                    <strong>{connectorDebug.indeedScraperMode || "server-side"}</strong>
                  </div>
                  <div>
                    <span>Crunchbase mode</span>
                    <strong>{connectorDebug.crunchbaseScraperMode || "server-side"}</strong>
                  </div>
                  <div>
                    <span>Mode</span>
                    <strong>hybrid</strong>
                  </div>
                </div>
            ) : (
              <p className="empty-state">Use "Refresh diagnostics" to inspect connector status.</p>
            )}
            <div className="action-row">
              <button type="button" className="secondary-button" onClick={refreshConnectorDebug}>
                Refresh connector status
              </button>
              <button type="button" onClick={runApifySoftprodigyTest} disabled={apifyLoading}>
                {apifyLoading ? "Running Apify test..." : "Run SoftProdigy Apify test"}
              </button>
            </div>
            {apifyError ? <p className="error">Apify error: {apifyError}</p> : null}
            {apifyDebug ? (
              <div className="apify-result">
                <div className="stats-grid compact">
                  <div>
                    <span>Actor</span>
                    <strong>{apifyDebug.actorId || "unknown"}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{apifyDebug.run?.status || "unknown"}</strong>
                  </div>
                  <div>
                    <span>Items</span>
                    <strong>{apifyDebug.items?.length || 0}</strong>
                  </div>
                  <div>
                    <span>Source</span>
                    <strong>{apifyDebug.source || "apify"}</strong>
                  </div>
                </div>
                <div className="apify-preview">
                  <span className="preview-label">First item preview</span>
                  <pre>{JSON.stringify(apifyDebug.items?.[0] || {}, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <p className="empty-state">Run the Apify test to preview the dataset returned by the backend.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
