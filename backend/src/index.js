const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const { leadPipeline } = require("./pipeline/leadPipeline");
const { getOpenAIDiagnostics, callWithOpenAI } = require("./services/openaiClient");
const { runWebSearch } = require("./services/webSearch");

const app = express();
const PORT = process.env.PORT || 3001;
const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY);

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

app.post("/lead", async (req, res) => {
  try {
    const { companyName, industry, companySize, geography } = req.body || {};

    console.log("[Frontend -> /lead Payload]", {
      at: new Date().toISOString(),
      payload: req.body || {}
    });

    if (!companyName || typeof companyName !== "string") {
      return res.status(400).json({
        error: "companyName is required and must be a string."
      });
    }

    const result = await leadPipeline({
      companyName: companyName.trim(),
      industry: industry || "",
      companySize: companySize || "",
      geography: geography || ""
    });

    return res.json(result);
  } catch (error) {
    console.error("Error in /lead:", error);
    return res.status(500).json({
      error: "Failed to run lead pipeline",
      details: error.message
    });
  }
});

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
});
