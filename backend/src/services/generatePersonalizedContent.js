const { hasOpenAIKey, callWithOpenAI, markFallback } = require("./openaiClient");

function buildPrompt({ company, decisionMakers, companySignals, insights, searchStrategy, input }) {
  const primaryDM = decisionMakers[0] || {};
  return `
Return strictly valid JSON:
{
  "subjectLine": "string",
  "email": "string",
  "linkedinMessage": "string",
  "callOpener": "string"
}

Context:
- Company: ${company.name}
- Industry: ${company.industry}
- Company size: ${input.companySize || "Unknown"}
- Geography: ${input.geography || "Unknown"}
- Website summary: ${company.websiteSummary?.description || company.websiteSummary?.title || "N/A"}
- Decision maker: ${primaryDM.name || "Unknown"} (${primaryDM.title || "Unknown"})
- Decision maker recent post: ${primaryDM.recentPost || "N/A"}
- Hiring roles: ${(companySignals.openRoles || []).join(", ")}
- Growth keywords: ${(companySignals.growthKeywords || []).join(", ") || "None"}
- Tech keywords: ${(companySignals.techKeywords || []).join(", ") || "None"}
- Outreach angle: ${insights.outreachAngle}
- Recommendation: ${insights.recommendation}
- Channel focus: ${(insights.bestChannels || []).join(", ")}
- Search focus: ${searchStrategy?.primaryPersonaFocus || "Commercial leadership"}

Constraints:
- Subject line: 4-8 words
- Email: 90-140 words, personal and specific, no generic hype
- LinkedIn message: 40-70 words
- Call opener: 1-2 sentences
- Include one concrete value proposition
- End outbound messages with a direct but low-pressure CTA
`;
}

function fallbackMessage({ company, decisionMakers, companySignals, input }) {
  const primaryDM = decisionMakers[0] || { name: "there", title: "leader" };
  const roles = (companySignals.openRoles || []).slice(0, 2).join(" and ");
  const email = `Hi ${primaryDM.name}, I noticed ${company.name} is growing${input.geography ? ` in ${input.geography}` : ""} and hiring for roles like ${roles}. Your recent update about scaling and efficiency stood out. I help teams reduce ramp time during growth by improving how reps research accounts and personalize outreach. If helpful, I can send a short teardown with two ideas tailored to ${company.name} and your ${primaryDM.title} priorities. Would it be useful to share that?`;

  return {
    subjectLine: `${company.name} growth idea`,
    email,
    linkedinMessage: `Hi ${primaryDM.name}, noticed ${company.name} is scaling and hiring for ${roles}. I work with teams improving account research and personalized outbound. Happy to share two ideas tailored to your priorities if useful.`,
    callOpener: `I was reaching out because ${company.name} appears to be scaling, and that usually puts pressure on outbound quality. I have a couple of specific ideas that may help your team move faster without adding manual research work.`
  };
}

async function generatePersonalizedContent(context) {
  if (!hasOpenAIKey()) {
    markFallback("Message generation used fallback: key missing");
    const fallback = fallbackMessage(context);
    return {
      model: "fallback-template",
      ...fallback,
      note: "OPENAI_API_KEY not set. Returned deterministic fallback message."
    };
  }

  const prompt = buildPrompt(context);

  const result = await callWithOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: prompt
  });

  if (!result.ok) {
    markFallback(`Message generation fallback: ${result.error.message}`);
    const fallback = fallbackMessage(context);
    return {
      model: "fallback-template",
      ...fallback,
      note: `OpenAI request failed (${result.error?.status || "unknown"}). Using fallback template.`
    };
  }

  const text = result.completion.output_text?.trim();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (_err) {
      parsed = null;
    }
  }

  if (!parsed) {
    markFallback("Message generation fallback: invalid or empty model output");
  }

  const fallback = fallbackMessage(context);

  return {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    subjectLine: parsed?.subjectLine || fallback.subjectLine,
    email: parsed?.email || fallback.email,
    linkedinMessage: parsed?.linkedinMessage || fallback.linkedinMessage,
    callOpener: parsed?.callOpener || fallback.callOpener,
    note: parsed ? "Generated using OpenAI." : "OpenAI returned unusable output. Used fallback."
  };
}

module.exports = {
  generatePersonalizedContent
};
