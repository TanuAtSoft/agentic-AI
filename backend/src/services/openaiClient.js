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

function extractJsonObject(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const direct = safeJsonParse(text);
  if (direct) {
    return direct;
  }

  const withoutFences = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const fenced = safeJsonParse(withoutFences);
  if (fenced) {
    return fenced;
  }

  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return safeJsonParse(withoutFences.slice(start, end + 1));
  }

  return null;
}

function markFallback(reason) {
  diagnostics.fallbackCount += 1;
  diagnostics.lastStatus = "fallback";
  diagnostics.lastErrorMessage = reason || "Fallback used";
}

function logOpenAIRequest(request) {
  console.log("[OpenAI Request]", {
    at: new Date().toISOString(),
    model: request?.model || null,
    tools: request?.tools || [],
    input: request?.input || null
  });
}

function logOpenAIResponse(completion) {
  console.log("[OpenAI Response]", {
    at: new Date().toISOString(),
    model: completion?.model || null,
    outputText: completion?.output_text || "",
    output: completion?.output || []
  });
}

function logOpenAIError(error) {
  console.error("[OpenAI Error]", {
    at: new Date().toISOString(),
    status: error?.status || 0,
    code: error?.code || null,
    type: error?.type || null,
    message: error?.message || "Unknown OpenAI error"
  });
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
    logOpenAIRequest(request);
    const completion = await client.responses.create(request);
    logOpenAIResponse(completion);
    diagnostics.successCount += 1;
    diagnostics.lastStatus = "success";
    diagnostics.lastSuccessAt = new Date().toISOString();
    diagnostics.lastErrorMessage = null;
    diagnostics.lastErrorCode = null;
    diagnostics.lastErrorType = null;
    diagnostics.lastErrorStatus = null;
    return { ok: true, completion };
  } catch (error) {
    logOpenAIError(error);
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
  extractJsonObject,
  callWithOpenAIRequest,
  callWithOpenAI,
  markFallback,
  getOpenAIDiagnostics
};
