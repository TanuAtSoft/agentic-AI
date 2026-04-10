const axios = require("axios");
const { hasApifyToken, runApifyActor } = require("./apifyClient");

function hasLinkedInScraperApi() {
  return Boolean(
    process.env.LINKEDIN_SCRAPER_API_URL ||
      (process.env.LINKEDIN_APIFY_ACTOR_ID && hasApifyToken())
  );
}

function hasLinkedInApifyActor() {
  return Boolean(process.env.LINKEDIN_APIFY_ACTOR_ID && hasApifyToken());
}

function getLinkedInIntegrationMode() {
  if (hasLinkedInApifyActor()) {
    return "apify";
  }

  if (process.env.LINKEDIN_SCRAPER_API_URL) {
    return "custom-api";
  }

  return "unconfigured";
}

function assertServerSide() {
  if (typeof window !== "undefined") {
    throw new Error("LinkedIn scraping API must be called from the server side.");
  }
}

function normalizeHeaderValue(headerName, apiKey) {
  if (!apiKey) {
    return null;
  }

  if (headerName.toLowerCase() === "authorization" && !/^bearer\s+/i.test(apiKey)) {
    return `Bearer ${apiKey}`;
  }

  return apiKey;
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

function uniqueStrings(items) {
  return [...new Set((items || []).map((item) => `${item}`.trim()).filter(Boolean))];
}

function summarizeEntries(entries) {
  return uniqueStrings(
    (entries || [])
      .slice(0, 5)
      .map((entry) => toText(entry).replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );
}

function buildLinkedInRequestPayload({ company, input }) {
  return {
    schema: "company_intent_signals_v1",
    company: {
      name: company.name,
      website: company.website,
      industry: company.industry,
      companySize: company.companySize,
      geography: company.geography
    },
    context: {
      researchGoal:
        "Extract public LinkedIn intent signals, hiring cues, employee footprint, and regional presence.",
      companyName: company.name,
      companyWebsite: company.website,
      industry: company.industry,
      companySize: company.companySize,
      geography: company.geography,
      searchIntent: `${company.name} LinkedIn hiring and footprint signals`
    },
    requestedSignals: [
      "company_overview",
      "recent_posts",
      "employees",
      "hiring",
      "locations",
      "headcount",
      "regional_presence"
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

function normalizeTextList(items, fallbackKeys = []) {
  return [...new Set((items || []).flatMap((item) => {
    if (item == null) {
      return [];
    }

    if (typeof item === "string") {
      return [item];
    }

    if (typeof item === "object") {
      const collected = [];
      for (const key of fallbackKeys) {
        if (item[key]) {
          collected.push(`${item[key]}`);
        }
      }
      if (!collected.length) {
        collected.push(Object.values(item).map((value) => `${value}`).join(" "));
      }
      return collected;
    }

    return [`${item}`];
  }).map((value) => value.trim()).filter(Boolean))].slice(0, 5);
}

function coerceApifyLinkedInItems(items, company, input) {
  const list = Array.isArray(items) ? items : [];
  const companyInfo = list.find((item) => item?.companyInfo || item?.companySummary || item?.profile || item?.overview) || {};
  const companyName = list.find((item) => item?.companyName)?.companyName || company.name;
  const website = list.find((item) => item?.website || item?.companyWebsite)?.website || company.website;
  const industry = list.find((item) => item?.industry)?.industry || company.industry;

  return {
    companyName,
    website,
    industry,
    companyInfo,
    posts: normalizeTextList(list, ["post", "text", "content", "description"]),
    employees: normalizeTextList(list.filter((item) => item?.name || item?.fullName || item?.title), [
      "name",
      "fullName",
      "title",
      "role"
    ]),
    hiring: normalizeTextList(list.filter((item) => item?.jobTitle || item?.role || item?.isJob), [
      "jobTitle",
      "role",
      "title"
    ]),
    locations: normalizeTextList(list.filter((item) => item?.location || item?.city || item?.region), [
      "location",
      "city",
      "region",
      "country"
    ]),
    headcount:
      list.find((item) => item?.headcount || item?.employeeCount || item?.size)?.headcount ||
      list.find((item) => item?.employeeCount || item?.size)?.employeeCount ||
      null,
    input
  };
}

function inferIntentSignals(text) {
  const lower = (text || "").toLowerCase();
  const signals = [];

  const keywordGroups = [
    {
      label: "hiring_momentum",
      keywords: ["we are hiring", "open roles", "join our team", "careers", "recruiting"],
      description: "Hiring language suggests active growth or capability buildout."
    },
    {
      label: "regional_expansion",
      keywords: ["launch", "expand", "opened", "new office", "emea", "apac", "latam"],
      description: "Regional expansion language points to footprint growth."
    },
    {
      label: "operational_modernization",
      keywords: ["automation", "platform", "integration", "workflow", "modernize", "digital transformation"],
      description: "Modernization language suggests an operations or tooling change window."
    },
    {
      label: "commercial_push",
      keywords: ["pipeline", "revenue", "growth", "scale", "demand", "go-to-market"],
      description: "Commercial language suggests GTM investment and buying urgency."
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

function normalizeLinkedInResponse(raw, company, input) {
  const companyInfo =
    raw?.companyInfo ||
    raw?.company ||
    raw?.companySummary ||
    raw?.profile ||
    raw?.overview ||
    {};
  const posts = raw?.posts || raw?.recentPosts || raw?.activities || raw?.updates || [];
  const employees = raw?.employees || raw?.people || raw?.profiles || raw?.contacts || [];
  const hiring = raw?.hiring || raw?.jobs || raw?.openRoles || raw?.jobPosts || [];
  const locations = raw?.locations || raw?.offices || raw?.regions || raw?.marketLocations || [];
  const headcount = raw?.headcount || raw?.employeeCount || raw?.size || raw?.employeeRange || null;
  const companyName = raw?.companyName || company.name;
  const website = raw?.website || raw?.companyWebsite || company.website;
  const sector = raw?.industry || company.industry;

  const combinedText = [
    toText(companyInfo),
    toText(posts),
    toText(employees),
    toText(hiring),
    toText(locations),
    company.name,
    input.industry,
    input.geography
  ]
    .filter(Boolean)
    .join(" ");

  const intentSignals = inferIntentSignals(combinedText);

  return {
    companyName,
    website,
    industry: sector,
    companyInfo,
    recentPosts: summarizeEntries(posts),
    employeeHighlights: summarizeEntries(employees),
    hiringSignals: summarizeEntries(hiring),
    locationSignals: summarizeEntries(locations),
    headcount,
    intentSignals,
    raw
  };
}

async function fetchLinkedInCompanySignals({ company, input }) {
  assertServerSide();

  if (hasLinkedInApifyActor()) {
    const payload = {
      ...buildLinkedInRequestPayload({ company, input }),
      apiVersion: "1.0"
    };

    const apifyResult = await runApifyActor({
      actorId: process.env.LINKEDIN_APIFY_ACTOR_ID,
      input: payload,
      timeoutSeconds: Number(process.env.LINKEDIN_APIFY_TIMEOUT_SECONDS || 120)
    });

    if (!apifyResult.ok) {
      return {
        ok: false,
        status: apifyResult.status || 500,
        source: "linkedin-apify",
        error: apifyResult.error
      };
    }

    const raw = coerceApifyLinkedInItems(apifyResult.items, company, input);
    const normalized = normalizeLinkedInResponse(raw, company, input);

    return {
      ok: true,
      source: "linkedin-apify",
      provider: process.env.LINKEDIN_APIFY_PROVIDER || "apify",
      runId: apifyResult.run?.id || null,
      ...normalized
    };
  }

  if (!process.env.LINKEDIN_SCRAPER_API_URL) {
    return {
      ok: false,
      status: 503,
      source: "not_configured",
      error: "LINKEDIN_SCRAPER_API_URL not set"
    };
  }

  const apiUrl = process.env.LINKEDIN_SCRAPER_API_URL;
  const apiKey = process.env.LINKEDIN_SCRAPER_API_KEY || "";
  const headerName = (process.env.LINKEDIN_SCRAPER_API_KEY_HEADER || "x-api-key").trim();
  const headers = {};
  const headerValue = normalizeHeaderValue(headerName, apiKey);

  if (headerValue) {
    headers[headerName] = headerValue;
  }

  const payload = {
    ...buildLinkedInRequestPayload({ company, input }),
    apiVersion: "1.0"
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      timeout: Number(process.env.LINKEDIN_SCRAPER_API_TIMEOUT_MS || 12000),
      headers
    });

    const raw = extractApiData(response.data);
    const normalized = normalizeLinkedInResponse(raw, company, input);

    return {
      ok: true,
      source: "linkedin-scraper-api",
      provider: process.env.LINKEDIN_SCRAPER_API_PROVIDER || "configured-api",
      ...normalized
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 500,
      source: "linkedin-scraper-api",
      error: error?.response?.data || error?.message || "LinkedIn scraping API request failed"
    };
  }
}

module.exports = {
  hasLinkedInScraperApi,
  getLinkedInIntegrationMode,
  fetchLinkedInCompanySignals
};
