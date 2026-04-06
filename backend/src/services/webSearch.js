const { hasOpenAIKey, callWithOpenAIRequest } = require("./openaiClient");

function normalizeAllowedDomains(domains) {
  if (!Array.isArray(domains)) {
    return [];
  }

  return domains
    .filter((domain) => typeof domain === "string")
    .map((domain) => domain.trim().replace(/^https?:\/\//, ""))
    .filter(Boolean)
    .slice(0, 100);
}

async function runWebSearch({
  query,
  allowedDomains = [],
  country,
  city,
  region,
  timezone
}) {
  if (!hasOpenAIKey()) {
    return {
      ok: false,
      status: 503,
      error: "OPENAI_API_KEY not set"
    };
  }

  const tool = {
    type: "web_search"
  };

  const normalizedDomains = normalizeAllowedDomains(allowedDomains);
  if (normalizedDomains.length > 0) {
    tool.filters = {
      allowed_domains: normalizedDomains
    };
  }

  const hasLocation = [country, city, region, timezone].some(Boolean);
  if (hasLocation) {
    tool.user_location = {
      type: "approximate",
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(region ? { region } : {}),
      ...(timezone ? { timezone } : {})
    };
  }

  const result = await callWithOpenAIRequest({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5",
    tools: [tool],
    input: query
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.error?.status || 500,
      error: result.error?.message || "OpenAI web search failed"
    };
  }

  const response = result.completion;
  const messageItem = (response.output || []).find((item) => item.type === "message");
  const contentItem = messageItem?.content?.find((item) => item.type === "output_text");
  const citations = (contentItem?.annotations || [])
    .filter((annotation) => annotation.type === "url_citation")
    .map((annotation) => ({
      title: annotation.title || null,
      url: annotation.url,
      startIndex: annotation.start_index,
      endIndex: annotation.end_index
    }));

  return {
    ok: true,
    model: response.model || process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5",
    answer: response.output_text?.trim() || "",
    citations
  };
}

module.exports = {
  runWebSearch
};
