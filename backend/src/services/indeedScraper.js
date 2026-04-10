const axios = require("axios");
const { hasApifyToken, runApifyActor } = require("./apifyClient");

function hasIndeedScraperApi() {
  return Boolean(
    process.env.INDEED_SCRAPER_API_URL || (process.env.INDEED_APIFY_ACTOR_ID && hasApifyToken())
  );
}

function hasIndeedApifyActor() {
  return Boolean(process.env.INDEED_APIFY_ACTOR_ID && hasApifyToken());
}

function getIndeedIntegrationMode() {
  if (hasIndeedApifyActor()) {
    return "apify";
  }

  if (process.env.INDEED_SCRAPER_API_URL) {
    return "custom-api";
  }

  return "unconfigured";
}

function assertServerSide() {
  if (typeof window !== "undefined") {
    throw new Error("Indeed scraping API must be called from the server side.");
  }
}

function toText(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value).map(toText).filter(Boolean).join(" ");
  }

  return String(value);
}

function normalizeEntries(entries) {
  return [...new Set((entries || []).map((item) => `${item}`.trim()).filter(Boolean))].slice(0, 5);
}

function inferHiringSignals(text) {
  const lower = (text || "").toLowerCase();
  const signals = [];

  const keywordGroups = [
    {
      label: "hiring_velocity",
      keywords: ["now hiring", "hiring", "join our team", "apply now", "open roles"],
      description: "Active job posting language suggests hiring velocity."
    },
    {
      label: "location_expansion",
      keywords: ["remote", "hybrid", "new york", "london", "singapore", "dublin", "san francisco"],
      description: "Multi-location or remote language suggests geographic coverage."
    },
    {
      label: "role_expansion",
      keywords: ["engineer", "manager", "analyst", "sales", "customer success", "operations"],
      description: "Role mix suggests which teams are scaling."
    }
  ];

  keywordGroups.forEach((group) => {
    const matched = group.keywords.filter((keyword) => lower.includes(keyword));
    if (matched.length) {
      signals.push({
        label: group.label,
        keywords: matched,
        description: group.description
      });
    }
  });

  return signals;
}

function buildIndeedRequestPayload({ company, input }) {
  return {
    schema: "hiring_trends_v1",
    company: {
      name: company.name,
      website: company.website,
      industry: company.industry,
      companySize: company.companySize,
      geography: company.geography
    },
    context: {
      researchGoal:
        "Extract public Indeed hiring trends, role mix, and geographic hiring footprint.",
      companyName: company.name,
      companyWebsite: company.website,
      industry: company.industry,
      companySize: company.companySize,
      geography: company.geography,
      searchIntent: `${company.name} Indeed hiring trends`
    },
    requestedSignals: [
      "job_postings",
      "role_titles",
      "locations",
      "salary_range",
      "hiring_velocity",
      "remote_vs_on_site"
    ],
    outputHints: {
      returnRawPayload: true,
      includePublicOnlyData: true,
      format: "json"
    },
    input
  };
}

function extractApiData(responseData) {
  if (!responseData || typeof responseData !== "object") {
    return {};
  }

  return responseData.data || responseData.result || responseData.payload || responseData;
}

function coerceApifyIndeedItems(items, company, input) {
  const list = Array.isArray(items) ? items : [];
  const companyName = list.find((item) => item?.companyName)?.companyName || company.name;
  const website = list.find((item) => item?.website || item?.companyWebsite)?.website || company.website;
  const industry = list.find((item) => item?.industry)?.industry || company.industry;

  return {
    companyName,
    website,
    industry,
    jobPostings: list.filter((item) => item?.jobTitle || item?.title || item?.role || item?.snippet),
    roleTitles: list.filter((item) => item?.jobTitle || item?.title || item?.role),
    locations: list.filter((item) => item?.location || item?.city || item?.region),
    salaryRanges: list.filter((item) => item?.salary || item?.salaryRange),
    hiringVelocity: list.find((item) => item?.hiringVelocity || item?.trend)?.hiringVelocity || null,
    raw: list,
    input
  };
}

function normalizeIndeedResponse(raw, company, input) {
  const companyName = raw?.companyName || company.name;
  const website = raw?.website || raw?.companyWebsite || company.website;
  const industry = raw?.industry || company.industry;
  const jobPostings = raw?.jobPostings || raw?.jobs || raw?.openRoles || raw?.postings || [];
  const locations = raw?.locations || raw?.cities || raw?.regions || [];
  const roleTitles = raw?.roleTitles || raw?.titles || raw?.roles || [];
  const salaryRanges = raw?.salaryRanges || raw?.salaryRange || [];
  const hiringVelocity = raw?.hiringVelocity || raw?.velocity || raw?.trend || "";

  const combinedText = [
    companyName,
    website,
    industry,
    toText(jobPostings),
    toText(locations),
    toText(roleTitles),
    toText(salaryRanges),
    hiringVelocity,
    input.industry,
    input.geography
  ]
    .filter(Boolean)
    .join(" ");

  return {
    companyName,
    website,
    industry,
    jobPostings: normalizeEntries(jobPostings),
    roleTitles: normalizeEntries(roleTitles),
    locations: normalizeEntries(locations),
    salaryRanges: normalizeEntries(salaryRanges),
    hiringVelocity: hiringVelocity || null,
    hiringIntentSignals: inferHiringSignals(combinedText),
    raw
  };
}

async function fetchIndeedCompanySignals({ company, input }) {
  assertServerSide();

  if (hasIndeedApifyActor()) {
    const payload = {
      ...buildIndeedRequestPayload({ company, input }),
      apiVersion: "1.0"
    };

    const apifyResult = await runApifyActor({
      actorId: process.env.INDEED_APIFY_ACTOR_ID,
      input: payload,
      timeoutSeconds: Number(process.env.INDEED_APIFY_TIMEOUT_SECONDS || 120)
    });

    if (!apifyResult.ok) {
      return {
        ok: false,
        status: apifyResult.status || 500,
        source: "indeed-apify",
        error: apifyResult.error
      };
    }

    const raw = coerceApifyIndeedItems(apifyResult.items, company, input);
    const normalized = normalizeIndeedResponse(raw, company, input);

    return {
      ok: true,
      source: "indeed-apify",
      provider: process.env.INDEED_APIFY_PROVIDER || "apify",
      runId: apifyResult.run?.id || null,
      ...normalized
    };
  }

  if (!process.env.INDEED_SCRAPER_API_URL) {
    return {
      ok: false,
      status: 503,
      source: "not_configured",
      error: "INDEED_SCRAPER_API_URL not set"
    };
  }

  const apiUrl = process.env.INDEED_SCRAPER_API_URL;
  const apiKey = process.env.INDEED_SCRAPER_API_KEY || "";
  const headerName = (process.env.INDEED_SCRAPER_API_KEY_HEADER || "x-api-key").trim();
  const headers = {};

  if (apiKey) {
    headers[headerName] =
      headerName.toLowerCase() === "authorization" && !/^bearer\s+/i.test(apiKey)
        ? `Bearer ${apiKey}`
        : apiKey;
  }

  const payload = {
    ...buildIndeedRequestPayload({ company, input }),
    apiVersion: "1.0"
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      timeout: Number(process.env.INDEED_SCRAPER_API_TIMEOUT_MS || 12000),
      headers
    });

    const raw = extractApiData(response.data);
    const normalized = normalizeIndeedResponse(raw, company, input);

    return {
      ok: true,
      source: "indeed-scraper-api",
      provider: process.env.INDEED_SCRAPER_API_PROVIDER || "configured-api",
      ...normalized
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 500,
      source: "indeed-scraper-api",
      error: error?.response?.data || error?.message || "Indeed scraping API request failed"
    };
  }
}

module.exports = {
  hasIndeedScraperApi,
  getIndeedIntegrationMode,
  fetchIndeedCompanySignals
};
