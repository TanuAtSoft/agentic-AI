const axios = require("axios");
const { hasApifyToken, runApifyActor } = require("./apifyClient");

function hasCrunchbaseScraperApi() {
  return Boolean(
    process.env.CRUNCHBASE_SCRAPER_API_URL ||
      (process.env.CRUNCHBASE_APIFY_ACTOR_ID && hasApifyToken())
  );
}

function hasCrunchbaseApifyActor() {
  return Boolean(process.env.CRUNCHBASE_APIFY_ACTOR_ID && hasApifyToken());
}

function getCrunchbaseIntegrationMode() {
  if (hasCrunchbaseApifyActor()) {
    return "apify";
  }

  if (process.env.CRUNCHBASE_SCRAPER_API_URL) {
    return "custom-api";
  }

  return "unconfigured";
}

function assertServerSide() {
  if (typeof window !== "undefined") {
    throw new Error("Crunchbase scraping API must be called from the server side.");
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

function inferFundingSignals(text) {
  const lower = (text || "").toLowerCase();
  const signals = [];

  const keywordGroups = [
    {
      label: "funding_event",
      keywords: ["series a", "series b", "series c", "seed", "raised", "funding", "investment"],
      description: "Funding language suggests capital availability and growth intent."
    },
    {
      label: "hiring_after_funding",
      keywords: ["scale", "expand", "growth", "hiring", "build", "accelerate"],
      description: "Growth language following capital events suggests expansion plans."
    },
    {
      label: "acquisition_activity",
      keywords: ["acquisition", "acquired", "merger", "m&a", "purchase"],
      description: "Acquisition language suggests integration or transformation intent."
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

function buildCrunchbaseRequestPayload({ company, input }) {
  return {
    schema: "funding_intent_v1",
    company: {
      name: company.name,
      website: company.website,
      industry: company.industry,
      companySize: company.companySize,
      geography: company.geography
    },
    context: {
      researchGoal:
        "Extract public Crunchbase funding signals, investors, growth stage, and acquisition intent.",
      companyName: company.name,
      companyWebsite: company.website,
      industry: company.industry,
      companySize: company.companySize,
      geography: company.geography,
      searchIntent: `${company.name} Crunchbase funding intent`
    },
    requestedSignals: [
      "funding_rounds",
      "last_funding_date",
      "investors",
      "employee_count",
      "acquisitions",
      "growth_stage"
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

function coerceApifyCrunchbaseItems(items, company, input) {
  const list = Array.isArray(items) ? items : [];
  const companyName = list.find((item) => item?.companyName)?.companyName || company.name;
  const website = list.find((item) => item?.website || item?.companyWebsite)?.website || company.website;
  const industry = list.find((item) => item?.industry)?.industry || company.industry;

  return {
    companyName,
    website,
    industry,
    fundingRounds: list.filter((item) => item?.round || item?.fundingRound || item?.type),
    investors: list.filter((item) => item?.investor || item?.name || item?.firm),
    acquisitions: list.filter((item) => item?.acquisition || item?.acquired || item?.merger),
    employeeCount: list.find((item) => item?.employeeCount || item?.headcount || item?.size)?.employeeCount || null,
    lastFundingDate: list.find((item) => item?.lastFundingDate || item?.fundedAt)?.lastFundingDate || null,
    lastFundingType: list.find((item) => item?.lastFundingType || item?.round)?.lastFundingType || null,
    raw: list,
    input
  };
}

function normalizeCrunchbaseResponse(raw, company, input) {
  const companyName = raw?.companyName || company.name;
  const website = raw?.website || raw?.companyWebsite || company.website;
  const industry = raw?.industry || company.industry;
  const fundingRounds = raw?.fundingRounds || raw?.rounds || raw?.funding || [];
  const investors = raw?.investors || raw?.backers || [];
  const acquisitions = raw?.acquisitions || raw?.mergers || [];
  const employeeCount = raw?.employeeCount || raw?.headcount || raw?.size || null;
  const lastFundingDate = raw?.lastFundingDate || raw?.lastRoundDate || null;
  const lastFundingType = raw?.lastFundingType || raw?.lastRoundType || null;

  const combinedText = [
    companyName,
    website,
    industry,
    toText(fundingRounds),
    toText(investors),
    toText(acquisitions),
    lastFundingDate,
    lastFundingType,
    input.industry
  ]
    .filter(Boolean)
    .join(" ");

  return {
    companyName,
    website,
    industry,
    fundingRounds: normalizeEntries(fundingRounds),
    investors: normalizeEntries(investors),
    acquisitions: normalizeEntries(acquisitions),
    employeeCount,
    lastFundingDate,
    lastFundingType,
    fundingIntentSignals: inferFundingSignals(combinedText),
    raw
  };
}

async function fetchCrunchbaseCompanySignals({ company, input }) {
  assertServerSide();

  if (hasCrunchbaseApifyActor()) {
    const payload = {
      ...buildCrunchbaseRequestPayload({ company, input }),
      apiVersion: "1.0"
    };

    const apifyResult = await runApifyActor({
      actorId: process.env.CRUNCHBASE_APIFY_ACTOR_ID,
      input: payload,
      timeoutSeconds: Number(process.env.CRUNCHBASE_APIFY_TIMEOUT_SECONDS || 120)
    });

    if (!apifyResult.ok) {
      return {
        ok: false,
        status: apifyResult.status || 500,
        source: "crunchbase-apify",
        error: apifyResult.error
      };
    }

    const raw = coerceApifyCrunchbaseItems(apifyResult.items, company, input);
    const normalized = normalizeCrunchbaseResponse(raw, company, input);

    return {
      ok: true,
      source: "crunchbase-apify",
      provider: process.env.CRUNCHBASE_APIFY_PROVIDER || "apify",
      runId: apifyResult.run?.id || null,
      ...normalized
    };
  }

  if (!process.env.CRUNCHBASE_SCRAPER_API_URL) {
    return {
      ok: false,
      status: 503,
      source: "not_configured",
      error: "CRUNCHBASE_SCRAPER_API_URL not set"
    };
  }

  const apiUrl = process.env.CRUNCHBASE_SCRAPER_API_URL;
  const apiKey = process.env.CRUNCHBASE_SCRAPER_API_KEY || "";
  const headerName = (process.env.CRUNCHBASE_SCRAPER_API_KEY_HEADER || "x-api-key").trim();
  const headers = {};

  if (apiKey) {
    headers[headerName] =
      headerName.toLowerCase() === "authorization" && !/^bearer\s+/i.test(apiKey)
        ? `Bearer ${apiKey}`
        : apiKey;
  }

  const payload = {
    ...buildCrunchbaseRequestPayload({ company, input }),
    apiVersion: "1.0"
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      timeout: Number(process.env.CRUNCHBASE_SCRAPER_API_TIMEOUT_MS || 12000),
      headers
    });

    const raw = extractApiData(response.data);
    const normalized = normalizeCrunchbaseResponse(raw, company, input);

    return {
      ok: true,
      source: "crunchbase-scraper-api",
      provider: process.env.CRUNCHBASE_SCRAPER_API_PROVIDER || "configured-api",
      ...normalized
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 500,
      source: "crunchbase-scraper-api",
      error: error?.response?.data || error?.message || "Crunchbase scraping API request failed"
    };
  }
}

module.exports = {
  hasCrunchbaseScraperApi,
  getCrunchbaseIntegrationMode,
  fetchCrunchbaseCompanySignals
};
