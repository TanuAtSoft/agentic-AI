import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const DEFAULT_INCLUDED_ROLES = [
  "CEO",
  "Chief Executive Officer",
  "Founder",
  "Co-Founder",
  "CTO",
  "Chief Technology Officer",
  "CFO",
  "Chief Financial Officer",
  "COO",
  "Chief Operating Officer",
  "CMO",
  "Chief Marketing Officer",
  "VP",
  "Vice President",
  "Head of",
  "Director",
  "General Manager"
];

const DEFAULT_EXCLUDED_ROLES = [
  "Intern",
  "Trainee",
  "Assistant",
  "Associate",
  "Coordinator",
  "Analyst",
  "Specialist",
  "Junior",
  "Entry Level"
];

const DEFAULT_FILTERS = {
  query: "",
  company: "",
  title: "",
  location: ""
};

const WORKFLOW_STEPS = [
  {
    id: "search",
    index: "01",
    title: "Decide where to search",
    description:
      "Choose company site, web, backend LinkedIn, Apollo company enrichment, Indeed, Crunchbase, and regional sources."
  },
  {
    id: "buyers",
    index: "02",
    title: "Identify decision-makers",
    description:
      "Find the most relevant leaders and explain why each one matters."
  },
  {
    id: "signals",
    index: "03",
    title: "Gather and analyze signals",
    description:
      "Pull hiring, growth, backend LinkedIn, Indeed, Crunchbase, regional, and messaging clues into a single view."
  },
  {
    id: "outreach",
    index: "04",
    title: "Generate outreach",
    description:
      "Craft personalized email, LinkedIn, and call-opening copy from the synthesized context."
  }
];

const SIGNAL_CHECKLIST = [
  "Hiring momentum and open roles",
  "Growth language and expansion clues",
  "Technology or process modernization indicators",
  "Executive or team messaging themes",
  "Regional and industry-specific relevance"
];

const SOURCES_USED = [
  "live-website-fetch",
  "linkedin-scraper-api (server-side unavailable)",
  "apollo-organization-enrich (server-side unavailable)",
  "indeed-scraper-api (server-side unavailable)",
  "crunchbase-scraper-api (server-side unavailable)",
  "hunter-domain-search (domain search)",
  "Company website (active)",
  "Search engine / web results (active)",
  "Server-side LinkedIn scraping API (planned)",
  "Server-side Indeed hiring API (planned)",
  "Server-side Crunchbase funding API (planned)",
  "Regional ecosystem signals (planned)",
  "Industry-specific communities (planned)"
];

function createSearchRow(index = 0) {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    label: `Search ${index + 1}`,
    keyword: "",
    personName: "",
    companyName: "",
    industry: "",
    location: "",
    employeeCountMode: "any",
    employeeCountMin: "",
    employeeCountMax: "",
    notes: ""
  };
}

function splitRoleList(value) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  if (/["\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(rows) {
  const headers = [
    "Person Name",
    "Designation",
    "Department",
    "Company Name",
    "LinkedIn Profile",
    "Phone Number",
    "Email ID"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.personName,
        row.designation,
        row.department,
        row.companyName,
        row.linkedinProfile,
        row.phoneNumber,
        row.emailId
      ]
        .map(escapeCsv)
        .join(",")
    )
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `decision-maker-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function matchesFilter(row, filters) {
  const composite = [
    row.personName,
    row.designation,
    row.department,
    row.companyName,
    row.linkedinProfile,
    row.phoneNumber,
    row.emailId,
    row.location,
    row.employeeCount,
    row.searchLabel
  ]
    .join(" ")
    .toLowerCase();

  const query = filters.query.trim().toLowerCase();
  const company = filters.company.trim().toLowerCase();
  const title = filters.title.trim().toLowerCase();
  const location = filters.location.trim().toLowerCase();

  if (query && !composite.includes(query)) {
    return false;
  }

  if (company && !`${row.companyName || ""}`.toLowerCase().includes(company)) {
    return false;
  }

  if (title && !`${row.designation || ""}`.toLowerCase().includes(title)) {
    return false;
  }

  if (location && !`${row.location || ""}`.toLowerCase().includes(location)) {
    return false;
  }

  return true;
}

function countUnique(rows, key) {
  return new Set(rows.map((row) => `${row[key] || ""}`.trim().toLowerCase()).filter(Boolean)).size;
}

function summarizeEmployeeCountRange(mode, min, max) {
  if (mode === "lt") {
    return min ? `Less than ${min}` : "Less than X";
  }

  if (mode === "gt") {
    return min ? `Greater than ${min}` : "Greater than Y";
  }

  if (mode === "between") {
    return min && max ? `Between ${min} and ${max}` : "Between X and Y";
  }

  return "Unavailable";
}

function getPrimarySearch(searches) {
  return Array.isArray(searches) && searches.length ? searches[0] : null;
}

function buildResearchBrief(searches, summary, results) {
  const primary = getPrimarySearch(searches) || {};
  const primaryContext =
    (Array.isArray(summary?.companyContexts) && summary.companyContexts.length
      ? summary.companyContexts[0]
      : null) ||
    results.find((row) => row?.companyContext) ||
    null;
  const resolvedContext = primaryContext?.companyContext || primaryContext;
  const companyName = primaryContext?.name || primary.companyName || "Target Company";
  const industry = resolvedContext?.industry || primary.industry || "Unknown";
  const geography = resolvedContext?.geography || primary.location || "Unknown";
  const employeeStrength = resolvedContext?.employeeStrength || "Unavailable";

  return {
    accountContext: {
      companyName,
      website: resolvedContext?.website || primaryContext?.companyWebsite || primary.website || "Unavailable",
      industry,
      companySize: employeeStrength,
      geography,
      employeeStrength,
      employeeStrengthSource:
        resolvedContext?.employeeStrengthSource || "unavailable",
      source: resolvedContext?.source || "live-website-fetch"
    },
    websiteTitle: resolvedContext?.websiteTitle || `${companyName} | Company overview`,
    detectedThemes: (() => {
      const fromDescription = resolvedContext?.websiteDescription
        ? resolvedContext.websiteDescription
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((word) => word.length > 4)
            .slice(0, 8)
        : [];

      return fromDescription.length ? fromDescription : [industry.toLowerCase()];
    })(),
    outreachName: `${companyName} Leader 1`
  };
}

export default function App() {
  const [searches, setSearches] = useState([createSearchRow(0)]);
  const [roleText, setRoleText] = useState({
    included: DEFAULT_INCLUDED_ROLES.join(", "),
    excluded: DEFAULT_EXCLUDED_ROLES.join(", ")
  });
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS
  });
  const [results, setResults] = useState([]);
  const [searchLogs, setSearchLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleConfigLoading, setRoleConfigLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRoleConfig() {
      setRoleConfigLoading(true);

      try {
        const response = await fetch(`${API_BASE}/config/decision-maker-roles`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!active) {
          return;
        }

        setRoleText({
          included: Array.isArray(data.included) && data.included.length
            ? data.included.join(", ")
            : DEFAULT_INCLUDED_ROLES.join(", "),
          excluded: Array.isArray(data.excluded) && data.excluded.length
            ? data.excluded.join(", ")
            : DEFAULT_EXCLUDED_ROLES.join(", ")
        });
      } catch (_error) {
        // Keep the local defaults if the config endpoint is unavailable.
      } finally {
        if (active) {
          setRoleConfigLoading(false);
        }
      }
    }

    loadRoleConfig();

    return () => {
      active = false;
    };
  }, []);

  const updateSearchRow = (id, field, value) => {
    setSearches((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addSearchRow = () => {
    setSearches((current) => [...current, createSearchRow(current.length)]);
  };

  const removeSearchRow = (id) => {
    setSearches((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  };

  const loadSample = () => {
    setSearches([
      {
        ...createSearchRow(0),
        label: "Software leadership",
        keyword: "cloud platform",
        industry: "Software",
        location: "United States",
        employeeCountMode: "between",
        employeeCountMin: "100",
        employeeCountMax: "5000",
        notes: "Prioritize CTO, VP Engineering, and Head of Product profiles."
      },
      {
        ...createSearchRow(1),
        label: "Healthcare operators",
        companyName: "healthcare",
        industry: "Healthcare",
        location: "India",
        employeeCountMode: "gt",
        employeeCountMin: "250",
        employeeCountMax: "",
        notes: "Focus on founders, directors, and general managers."
      }
    ]);
    setFilters({
      ...DEFAULT_FILTERS
    });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    setResults([]);
    setSearchLogs([]);
    setSummary(null);

    try {
      const payload = {
        searches: searches.map((row) => ({
          id: row.id,
          label: row.label,
          keyword: row.keyword,
          personName: row.personName,
          companyName: row.companyName,
          industry: row.industry,
          location: row.location,
          employeeCountRange:
            row.employeeCountMode === "any"
              ? { mode: "any", min: "", max: "" }
              : {
                  mode: row.employeeCountMode,
                  min: row.employeeCountMin,
                  max: row.employeeCountMax
                },
          notes: row.notes
        })),
        roleMapping: {
          included: splitRoleList(roleText.included),
          excluded: splitRoleList(roleText.excluded)
        },
        maxResultsPerSearch: 10
      };

      const response = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Search failed");
      }

      setResults(Array.isArray(data.results) ? data.results : []);
      setSearchLogs(Array.isArray(data.searchLogs) ? data.searchLogs : []);
      setSummary(data);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = results.filter((row) => matchesFilter(row, filters));
  const visibleCount = filteredResults.length;
  const uniqueCompanies = countUnique(filteredResults, "companyName");
  const uniqueRoles = countUnique(filteredResults, "designation");
  const researchBrief = buildResearchBrief(searches, summary, results);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Lead Search & Decision-Maker Extraction Tool</p>
          <h1>Search by flexible criteria and extract only the people who can actually decide.</h1>
          <p className="subtitle">
            Build one or more search rows from keyword, person name, company, industry, location,
            and employee-count range. The backend resolves public decision-maker profiles, filters
            out junior roles, and returns a clean contact table ready for export.
          </p>
        </div>

        <div className="hero-metrics">
          <article className="metric-card accent">
            <span>Scope</span>
            <strong>Decision-makers only</strong>
            <p>Includes C-level, founders, directors, VPs, heads, and general managers.</p>
          </article>
          <article className="metric-card">
            <span>Workflow</span>
            <strong>Search, filter, export</strong>
            <p>Run multiple queries, refine the table with filters, and export CSV in one click.</p>
          </article>
        </div>
      </section>

      <section className="workflow-strip" aria-label="Workflow overview">
        {WORKFLOW_STEPS.map((step) => (
          <article key={step.id} className="workflow-card">
            <span className="workflow-index">{step.index}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel builder-panel">
          <div className="panel-heading">
            <p className="eyebrow">Search builder</p>
            <h2>Define one or more searches</h2>
          </div>

          <div className="builder-actions">
            <button type="button" className="secondary-button" onClick={loadSample}>
              Load sample
            </button>
            <button type="button" className="secondary-button" onClick={addSearchRow}>
              Add search row
            </button>
          </div>

          <form onSubmit={handleSubmit} className="search-form">
            {searches.map((row, index) => (
              <article key={row.id} className="search-card">
                <div className="search-card-head">
                  <div>
                    <span className="search-index">Search {index + 1}</span>
                    <input
                      className="search-label"
                      value={row.label}
                      onChange={(event) => updateSearchRow(row.id, "label", event.target.value)}
                      placeholder="Search label"
                    />
                  </div>

                  {searches.length > 1 ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeSearchRow(row.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="field-grid">
                  <label>
                    <span>Keyword</span>
                    <input
                      value={row.keyword}
                      onChange={(event) => updateSearchRow(row.id, "keyword", event.target.value)}
                      placeholder="e.g. healthcare platform"
                    />
                  </label>
                  <label>
                    <span>Person name</span>
                    <input
                      value={row.personName}
                      onChange={(event) => updateSearchRow(row.id, "personName", event.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </label>
                  <label>
                    <span>Company name</span>
                    <input
                      value={row.companyName}
                      onChange={(event) => updateSearchRow(row.id, "companyName", event.target.value)}
                      placeholder="e.g. Stripe"
                    />
                  </label>
                  <label>
                    <span>Industry</span>
                    <input
                      value={row.industry}
                      onChange={(event) => updateSearchRow(row.id, "industry", event.target.value)}
                      placeholder="e.g. Software"
                    />
                  </label>
                  <label>
                    <span>Location</span>
                    <input
                      value={row.location}
                      onChange={(event) => updateSearchRow(row.id, "location", event.target.value)}
                      placeholder="Country, city, or region"
                    />
                  </label>
                  <label>
                    <span>Employee count</span>
                    <select
                      value={row.employeeCountMode}
                      onChange={(event) =>
                        updateSearchRow(row.id, "employeeCountMode", event.target.value)
                      }
                    >
                      <option value="any">Any</option>
                      <option value="lt">Less than</option>
                      <option value="gt">Greater than</option>
                      <option value="between">Between</option>
                    </select>
                  </label>
                  <label>
                    <span>Min</span>
                    <input
                      value={row.employeeCountMin}
                      onChange={(event) => updateSearchRow(row.id, "employeeCountMin", event.target.value)}
                      placeholder="100"
                      disabled={row.employeeCountMode === "any" || row.employeeCountMode === "lt"}
                    />
                  </label>
                  <label>
                    <span>Max</span>
                    <input
                      value={row.employeeCountMax}
                      onChange={(event) => updateSearchRow(row.id, "employeeCountMax", event.target.value)}
                      placeholder="5000"
                      disabled={row.employeeCountMode === "any" || row.employeeCountMode === "gt"}
                    />
                  </label>
                </div>

                <label className="notes-field">
                  <span>Notes</span>
                  <textarea
                    value={row.notes}
                    onChange={(event) => updateSearchRow(row.id, "notes", event.target.value)}
                    placeholder="Optional guidance, such as preferred titles or segments."
                    rows={3}
                  />
                </label>
              </article>
            ))}

            <div className="role-editor">
              <div className="panel-heading compact">
                <p className="eyebrow">Role mapping</p>
                <h3>Configurable decision-maker titles</h3>
              </div>

              <label>
                <span>Included titles</span>
                <textarea
                  rows={4}
                  value={roleText.included}
                  onChange={(event) =>
                    setRoleText((current) => ({ ...current, included: event.target.value }))
                  }
                  placeholder="CEO, Founder, VP, Director..."
                />
              </label>
              <label>
                <span>Excluded titles</span>
                <textarea
                  rows={4}
                  value={roleText.excluded}
                  onChange={(event) =>
                    setRoleText((current) => ({ ...current, excluded: event.target.value }))
                  }
                  placeholder="Intern, Trainee, Junior..."
                />
              </label>
              {roleConfigLoading ? <p className="micro-copy">Loading default role mapping...</p> : null}
            </div>

            <div className="button-row">
              <button type="submit" disabled={loading}>
                {loading ? "Searching..." : "Run search"}
              </button>
              {loading ? (
                <p className="loading-copy">Please wait while we fetch and filter decision-makers.</p>
              ) : null}
            </div>

            <div className="hint-box">
              <strong>Output fields</strong>
              <p>
                Person name, designation, department, company name, LinkedIn profile, phone number,
                and email ID in a structured table.
              </p>
            </div>

            {error ? <p className="error">Error: {error}</p> : null}
          </form>
        </aside>

        <section className="results-stack">
          {loading ? (
            <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
              <div className="loading-card">
                <span className="loading-spinner" />
                <strong>Searching decision-makers</strong>
                <p>Finding matching leaders and preparing the table.</p>
              </div>
            </div>
          ) : null}

          <section className="panel summary-panel">
            <div className="panel-heading">
              <p className="eyebrow">Results</p>
              <h2>Decision-maker table</h2>
            </div>

            {summary ? (
              <>
                <div className="stats-grid compact">
                  <article className="stat-tile">
                    <span>Matched rows</span>
                    <strong>{visibleCount}</strong>
                  </article>
                  <article className="stat-tile">
                    <span>Companies</span>
                    <strong>{uniqueCompanies}</strong>
                  </article>
                  <article className="stat-tile">
                    <span>Roles</span>
                    <strong>{uniqueRoles}</strong>
                  </article>
                  <article className="stat-tile">
                    <span>Searches</span>
                    <strong>{summary.searchCount || searches.length}</strong>
                  </article>
                </div>
                <div className="results-banner">
                  <span>Mode</span>
                  <p>{summary.sourceMode === "openai-web-search" ? "Live web search" : "Local fallback"}</p>
                </div>
                <p className="micro-copy">
                  Generated at {new Date(summary.generatedAt).toLocaleString()} | Roles filtered using{" "}
                  {Array.isArray(summary.roleMapping?.included)
                    ? summary.roleMapping.included.length
                    : 0}{" "}
                  included and{" "}
                  {Array.isArray(summary.roleMapping?.excluded)
                    ? summary.roleMapping.excluded.length
                    : 0}{" "}
                  excluded title keywords.
                </p>
              </>
            ) : (
              <p className="empty-state">
                Run a search to populate the decision-maker table.
              </p>
            )}
          </section>

          <section className="panel brief-panel">
            <div className="panel-heading compact">
              <p className="eyebrow">Research brief</p>
              <h3>Signal checklist, context, and outreach</h3>
            </div>

            <div className="brief-grid">
              <article className="brief-card">
                <strong>Signal checklist</strong>
                <ul>
                  {SIGNAL_CHECKLIST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="brief-card">
                <strong>Sources used</strong>
                <ul>
                  {SOURCES_USED.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="brief-card">
                <strong>Account context</strong>
                <dl className="brief-definition-list">
                  <div>
                    <dt>{researchBrief.accountContext.companyName}</dt>
                    <dd>Website: {researchBrief.accountContext.website}</dd>
                  </div>
                  <div>
                    <dt>Industry</dt>
                    <dd>{researchBrief.accountContext.industry}</dd>
                  </div>
                  <div>
                    <dt>Company size</dt>
                    <dd>{researchBrief.accountContext.companySize}</dd>
                  </div>
                  <div>
                    <dt>Geography</dt>
                    <dd>{researchBrief.accountContext.geography}</dd>
                  </div>
                  <div>
                    <dt>Employee strength</dt>
                    <dd>
                      {researchBrief.accountContext.employeeStrength} |{" "}
                      {researchBrief.accountContext.employeeStrengthSource}
                    </dd>
                  </div>
                  <div>
                    <dt>Data source</dt>
                    <dd>{researchBrief.accountContext.source}</dd>
                  </div>
                  <div>
                    <dt>Website title</dt>
                    <dd>{researchBrief.websiteTitle}</dd>
                  </div>
                  <div>
                    <dt>Detected themes</dt>
                    <dd>{researchBrief.detectedThemes.join(", ")}</dd>
                  </div>
                </dl>
              </article>

              <article className="brief-card">
                <strong>Hybrid signals and ICP</strong>
                <div className="brief-subsection">
                  <span>LinkedIn intent signals</span>
                  <p>No LinkedIn API data was returned for this account.</p>
                  <p className="micro-copy">Source: unavailable | Provider: n/a</p>
                </div>
                <div className="brief-subsection">
                  <span>Indeed hiring trends</span>
                  <p>No Indeed hiring data was returned for this account.</p>
                  <p className="micro-copy">Source: unavailable | Provider: n/a</p>
                </div>
                <div className="brief-subsection">
                  <span>Crunchbase funding signals</span>
                  <p>No Crunchbase funding data was returned for this account.</p>
                  <p className="micro-copy">Source: unavailable | Provider: n/a</p>
                </div>
                <div className="brief-subsection">
                  <span>Finalized ICP</span>
                  <p>Growth-oriented accounts with active hiring, modernization, or expansion signals</p>
                  <ul>
                    <li>Public hiring momentum</li>
                    <li>Regional expansion cues</li>
                    <li>Technology or workflow modernization language</li>
                    <li>Clear executive ownership for change</li>
                  </ul>
                </div>
                <div className="brief-subsection">
                  <span>Target segments</span>
                  <ul>
                    <li>Primary ICP: high | Best-fit accounts with active growth or hiring motion</li>
                    <li>Functions: Revenue Operations, Sales Leadership, Marketing Operations</li>
                    <li>Triggers: Backend Engineer, Solutions Architect, Product Manager</li>
                    <li>Secondary ICP: medium | Adjacent accounts that are growing but may need more education</li>
                    <li>Functions: Operations, Business Strategy, Revenue</li>
                    <li>Triggers: regional_expansion, commercial_push, operational_modernization</li>
                    <li>Expansion ICP: medium | Accounts in regions or subsidiaries where footprint is spreading</li>
                    <li>Functions: Regional Leadership, Operations, Sales Leadership</li>
                    <li>Triggers: regional_expansion, headcount_growth, multi_location_presence</li>
                  </ul>
                </div>
              </article>

              <article className="brief-card">
                <strong>Regional footprint</strong>
                <dl className="brief-definition-list">
                  <div>
                    <dt>HQ hypothesis</dt>
                    <dd>{researchBrief.accountContext.geography}</dd>
                  </div>
                  <div>
                    <dt>Regions detected</dt>
                    <dd>{researchBrief.accountContext.geography}, core</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>medium</dd>
                  </div>
                </dl>
                <p className="micro-copy">No explicit hiring language detected on sampled website content</p>
              </article>

              <article className="brief-card brief-card-wide">
                <strong>Outreach</strong>
                <div className="brief-subsection">
                  <span>Subject line</span>
                  <p>Scaling {researchBrief.accountContext.companyName}'s Growth with Confidence</p>
                </div>
                <div className="brief-subsection">
                  <span>Email</span>
                  <p>
                    Hi {researchBrief.outreachName}, I noticed your recent focus on hiring,
                    modernization, and operational efficiency. At [Your Company], we help growth
                    teams reduce execution risk while they scale. Would you be open to a brief
                    call next week to explore how we can support {researchBrief.accountContext.companyName}&apos;s scale-up
                    efforts?
                  </p>
                </div>
                <div className="brief-subsection">
                  <span>LinkedIn message</span>
                  <p>
                    Hi {researchBrief.outreachName}, I saw your focus on hiring and operational
                    efficiency. We help growth teams scale with less friction. Would you be open
                    to a short chat?
                  </p>
                </div>
                <div className="brief-subsection">
                  <span>Call opener</span>
                  <p>
                    I saw you&apos;re focusing on improving operational efficiency during your
                    hiring push. How are you managing execution risk while scaling your teams?
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className="panel filters-panel">
            <div className="panel-heading compact">
              <p className="eyebrow">Filters</p>
              <h3>Refine the table</h3>
            </div>

            <div className="filter-grid">
              <label>
                <span>Search text</span>
                <input
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Search across all columns"
                />
              </label>
              <label>
                <span>Company</span>
                <input
                  value={filters.company}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, company: event.target.value }))
                  }
                  placeholder="Filter by company"
                />
              </label>
              <label>
                <span>Designation</span>
                <input
                  value={filters.title}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Filter by title"
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  value={filters.location}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="Filter by location"
                />
              </label>
            </div>

            <div className="builder-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
              >
                Clear filters
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!filteredResults.length}
                onClick={() => downloadCsv(filteredResults)}
              >
                Export CSV
              </button>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-heading compact">
              <p className="eyebrow">Tabular output</p>
              <h3>Structured contact list</h3>
            </div>

            {filteredResults.length ? (
              <div className="table-wrap">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>Person Name</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th>Company Name</th>
                      <th>LinkedIn Profile</th>
                      <th>Phone Number</th>
                      <th>Email ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Person Name">
                          <strong>{row.personName || "Unknown"}</strong>
                        </td>
                        <td data-label="Designation">{row.designation || "Unknown"}</td>
                        <td data-label="Department">{row.department || "n/a"}</td>
                        <td data-label="Company Name">
                          <strong>{row.companyName || "Unknown"}</strong>
                        </td>
                        <td data-label="LinkedIn Profile">
                          {row.linkedinProfile ? (
                            <a href={row.linkedinProfile} target="_blank" rel="noreferrer">
                              Open profile
                            </a>
                          ) : (
                            <span className="muted">Unavailable</span>
                          )}
                        </td>
                        <td data-label="Phone Number">{row.phoneNumber || "Unavailable"}</td>
                        <td data-label="Email ID">{row.emailId || "Unavailable"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                {results.length
                  ? "No rows match the current filters."
                  : "No results yet. Submit a search to populate the table."}
              </p>
            )}
          </section>

          {searchLogs.length ? (
            <section className="panel">
              <div className="panel-heading compact">
                <p className="eyebrow">Search logs</p>
                <h3>How the backend resolved each row set</h3>
              </div>
              <div className="log-grid">
                {searchLogs.map((log) => (
                  <article key={log.id} className="log-card">
                    <div className="log-topline">
                      <strong>{log.label}</strong>
                      <span>{log.resultCount} rows</span>
                    </div>
                    <p>{log.summary}</p>
                    <p className="micro-copy">
                      {log.mode} | {log.criteria?.keyword || log.criteria?.companyName || "criteria provided"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

        </section>
      </section>
    </main>
  );
}
