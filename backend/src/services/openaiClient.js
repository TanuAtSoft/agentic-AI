const OpenAI = require("openai");

const diagnostics = {
  configured: false,
  totalAttempts: 0,
  successCount: 0,
  failureCount: 0,
  fallbackCount: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastStatus: "not_attempted",
  lastModel: null,
  lastErrorMessage: null,
  lastErrorCode: null,
  lastErrorType: null,
  lastErrorStatus: null
};

function hasOpenAIKey() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  diagnostics.configured = configured;
  return configured;
}

function getOpenAIClient() {
  if (!hasOpenAIKey()) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
}

function markFallback(reason) {
  diagnostics.fallbackCount += 1;
  diagnostics.lastStatus = "fallback";
  diagnostics.lastErrorMessage = reason || "Fallback used";
}

async function callWithOpenAIRequest(request) {
  diagnostics.totalAttempts += 1;
  diagnostics.lastAttemptAt = new Date().toISOString();
  diagnostics.lastModel = request?.model || null;

  const client = getOpenAIClient();
  if (!client) {
    diagnostics.failureCount += 1;
    diagnostics.lastStatus = "missing_key";
    diagnostics.lastErrorAt = new Date().toISOString();
    diagnostics.lastErrorMessage = "OPENAI_API_KEY not set";
    return { ok: false, error: { status: 0, message: "OPENAI_API_KEY not set" } };
  }

  try {
    const completion = await client.responses.create(request);
    diagnostics.successCount += 1;
    diagnostics.lastStatus = "success";
    diagnostics.lastSuccessAt = new Date().toISOString();
    diagnostics.lastErrorMessage = null;
    diagnostics.lastErrorCode = null;
    diagnostics.lastErrorType = null;
    diagnostics.lastErrorStatus = null;
    return { ok: true, completion };
  } catch (error) {
    diagnostics.failureCount += 1;
    diagnostics.lastStatus = "error";
    diagnostics.lastErrorAt = new Date().toISOString();
    diagnostics.lastErrorMessage = error?.message || "Unknown OpenAI error";
    diagnostics.lastErrorCode = error?.code || null;
    diagnostics.lastErrorType = error?.type || null;
    diagnostics.lastErrorStatus = error?.status || 0;
    return {
      ok: false,
      error: {
        status: error?.status || 0,
        message: error?.message || "Unknown OpenAI error",
        code: error?.code || null,
        type: error?.type || null
      }
    };
  }
}

async function callWithOpenAI({ model, input }) {
  return callWithOpenAIRequest({ model, input });
}

function getOpenAIDiagnostics() {
  return { ...diagnostics };
}

module.exports = {
  hasOpenAIKey,
  getOpenAIClient,
  safeJsonParse,
  callWithOpenAIRequest,
  callWithOpenAI,
  markFallback,
  getOpenAIDiagnostics
};
