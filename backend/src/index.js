const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { getOpenAIDiagnostics, callWithOpenAI } = require("./services/openaiClient");
const { runWebSearch } = require("./services/webSearch");
const { hasApifyToken, runApifyActor } = require("./services/apifyClient");
const { hasHunterApiKey } = require("./services/hunterDomainSearch");
const { hasApolloApiKey } = require("./services/apolloCompanyEnrich");
const {
  DEFAULT_INCLUDED_ROLE_KEYWORDS,
  DEFAULT_EXCLUDED_ROLE_KEYWORDS,
  searchDecisionMakerLeads
} = require("./services/decisionMakerSearch");

const envPath = path.join(__dirname, "..", ".env");
const envLocalPath = path.join(__dirname, "..", ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const app = express();
const PORT = process.env.PORT || 3001;
const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY);
const HAS_APIFY_TOKEN = hasApifyToken();
const HAS_HUNTER_KEY = hasHunterApiKey();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lead-research-backend", openaiConfigured: HAS_OPENAI_KEY });
});

app.get("/debug/openai", (_req, res) => {
  res.json({
    openaiConfigured: HAS_OPENAI_KEY,
    diagnostics: getOpenAIDiagnostics()
  });
});

app.get("/debug/connectors", (_req, res) => {
  const { hasLinkedInScraperApi, getLinkedInIntegrationMode } = require("./services/linkedinScraper");
  const { hasIndeedScraperApi, getIndeedIntegrationMode } = require("./services/indeedScraper");
  const { hasCrunchbaseScraperApi, getCrunchbaseIntegrationMode } = require("./services/crunchbaseScraper");
  const { getApolloIntegrationMode } = require("./services/apolloCompanyEnrich");

  res.json({
    openaiConfigured: HAS_OPENAI_KEY,
    apifyConfigured: HAS_APIFY_TOKEN,
    hunterConfigured: HAS_HUNTER_KEY,
    apolloConfigured: hasApolloApiKey(),
    linkedinScraperConfigured: hasLinkedInScraperApi(),
    indeedScraperConfigured: hasIndeedScraperApi(),
    crunchbaseScraperConfigured: hasCrunchbaseScraperApi(),
    apolloIntegrationMode: getApolloIntegrationMode(),
    linkedinScraperMode: getLinkedInIntegrationMode(),
    indeedScraperMode: getIndeedIntegrationMode(),
    crunchbaseScraperMode: getCrunchbaseIntegrationMode()
  });
});

app.get("/config/decision-maker-roles", (_req, res) => {
  res.json({
    included: DEFAULT_INCLUDED_ROLE_KEYWORDS,
    excluded: DEFAULT_EXCLUDED_ROLE_KEYWORDS
  });
});

app.post("/debug/apify/softprodigy", async (req, res) => {
  try {
    const actorId = process.env.SOFTPRODIGY_APIFY_ACTOR_ID || "GWVs761IEVnlW4SYp";
    const input = {
      url: "https://softprodigy.com/",
      limit: "10",
      ...(req.body && typeof req.body === "object" ? req.body : {})
    };

    if (!actorId) {
      return res.status(400).json({
        ok: false,
        error: "Missing Apify actor id."
      });
    }

    const result = await runApifyActor({
      actorId,
      input,
      timeoutSeconds: Number(process.env.SOFTPRODIGY_APIFY_TIMEOUT_SECONDS || 120)
    });

    if (!result.ok) {
      return res.status(result.status || 500).json({
        ok: false,
        source: "apify",
        actorId,
        input,
        error: result.error
      });
    }

    return res.json({
      ok: true,
      source: "apify",
      actorId,
      input,
      run: result.run,
      items: result.items
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      source: "apify",
      error: {
        status: 500,
        message: error.message
      }
    });
  }
});

app.get("/debug/test-openai", async (_req, res) => {
  try {
    const result = await callWithOpenAI({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: "Reply with exactly this text: OK"
    });

    if (!result.ok) {
      return res.status(result.error?.status || 500).json({
        ok: false,
        openaiConfigured: HAS_OPENAI_KEY,
        error: result.error,
        diagnostics: getOpenAIDiagnostics()
      });
    }

    return res.json({
      ok: true,
      openaiConfigured: HAS_OPENAI_KEY,
      model: result.completion?.model || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      outputText: result.completion?.output_text || "",
      diagnostics: getOpenAIDiagnostics()
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      openaiConfigured: HAS_OPENAI_KEY,
      error: {
        status: 500,
        message: error.message
      },
      diagnostics: getOpenAIDiagnostics()
    });
  }
});

async function handleDecisionMakerSearch(req, res) {
  try {
    const payload = req.body || {};

    console.log("[Frontend -> /search Payload]", {
      at: new Date().toISOString(),
      payload
    });

    const result = await searchDecisionMakerLeads(payload);

    if (!result.ok) {
      return res.status(result.status || 400).json({
        error: result.error || "Unable to process search request"
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error in decision-maker search:", error);
    return res.status(500).json({
      error: "Failed to run decision-maker search",
      details: error.message
    });
  }
}

app.post("/search", handleDecisionMakerSearch);

app.post("/lead", handleDecisionMakerSearch);

app.post("/web-search", async (req, res) => {
  try {
    const {
      query,
      allowedDomains,
      userLocation
    } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "query is required and must be a string."
      });
    }

    const result = await runWebSearch({
      query: query.trim(),
      allowedDomains,
      country: userLocation?.country,
      city: userLocation?.city,
      region: userLocation?.region,
      timezone: userLocation?.timezone
    });

    if (!result.ok) {
      return res.status(result.status || 500).json({
        error: "Failed to run web search",
        details: result.error
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Error in /web-search:", error);
    return res.status(500).json({
      error: "Failed to run web search",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  if (!HAS_OPENAI_KEY) {
    console.warn("OPENAI_API_KEY is missing in backend/.env. The API will use fallback behavior.");
  }
  if (!hasApolloApiKey()) {
    console.warn(
      "APOLLO_API_KEY or APOLLO_MASTER_KEY is missing in backend/.env. Apollo employee strength enrichment will be unavailable."
    );
  }
  // Deploy trigger: keep Render backend redeploys in sync with Apollo configuration changes.
});
