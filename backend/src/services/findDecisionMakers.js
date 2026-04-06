function buildTitleCandidates(industry) {
  const lower = (industry || "").toLowerCase();

  if (lower.includes("software") || lower.includes("saas") || lower.includes("technology")) {
    return ["Chief Technology Officer", "VP Engineering"];
  }

  if (lower.includes("marketing")) {
    return ["Chief Marketing Officer", "Head of Growth"];
  }

  return ["Chief Executive Officer", "Head of Operations"];
}

const { hasOpenAIKey, safeJsonParse, callWithOpenAI, markFallback } = require("./openaiClient");

function fallbackDecisionMakers(company) {
  const titles = buildTitleCandidates(company.industry);
  const safeName = company.name.split(" ")[0] || "Company";
  return titles.slice(0, 2).map((title, index) => ({
    name: `${safeName} Leader ${index + 1}`,
    title,
    profileUrl: `https://www.linkedin.com/in/${safeName.toLowerCase()}-${index + 1}`,
    recentPost:
      index === 0
        ? "We are investing in hiring and improving operational efficiency."
        : "Excited about building strategic partnerships this quarter.",
    confidence: "medium",
    source: "POC-mock",
    whyRelevant:
      index === 0
        ? "Likely owns team priorities and can sponsor new initiatives."
        : "Likely influences process or vendor evaluation."
  }));
}

async function findDecisionMakers(company, _input, searchStrategy) {
  if (!hasOpenAIKey()) {
    markFallback("Decision maker inference used fallback: key missing");
    return fallbackDecisionMakers(company);
  }

  const prompt = `
Return exactly valid JSON with this schema:
{
  "decisionMakers": [
    {
      "name": "string",
      "title": "string",
      "profileUrl": "string",
      "recentPost": "string",
      "confidence": "low|medium|high",
      "source": "string",
      "whyRelevant": "string"
    }
  ]
}

Context:
- Company: ${company.name}
- Industry: ${company.industry}
- Website: ${company.website}
- Website title: ${company.websiteSummary?.title || ""}
- Website description: ${company.websiteSummary?.description || ""}
- Website snippet: ${company.websiteSummary?.textSnippet || ""}
- Search focus: ${searchStrategy?.primaryPersonaFocus || "Commercial leadership"}

Task:
- Infer 2 likely decision makers relevant for B2B sales outreach.
- If uncertain, clearly mark confidence "low" or "medium".
- Explain in one sentence why each person is worth targeting.
- Keep output strictly JSON.
`;

  try {
    const result = await callWithOpenAI({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt
    });
    if (!result.ok) {
      markFallback(`Decision maker inference fallback: ${result.error.message}`);
      return fallbackDecisionMakers(company);
    }

    const parsed = safeJsonParse(result.completion.output_text || "");
    const list = parsed?.decisionMakers;
    if (Array.isArray(list) && list.length) {
      return list.slice(0, 2).map((item) => ({
        name: item.name || "Unknown",
        title: item.title || "Unknown",
        profileUrl: item.profileUrl || "",
        recentPost: item.recentPost || "No public post inferred.",
        confidence: item.confidence || "low",
        source: item.source || "OpenAI inference",
        whyRelevant: item.whyRelevant || "Likely aligned to the buying problem."
      }));
    }
  } catch (_err) {
    // Intentional fallback for resiliency.
  }

  markFallback("Decision maker inference output parsing failed");
  return fallbackDecisionMakers(company);
}

module.exports = {
  findDecisionMakers
};
