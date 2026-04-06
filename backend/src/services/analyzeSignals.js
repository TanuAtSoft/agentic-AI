const { hasOpenAIKey, safeJsonParse, callWithOpenAI, markFallback } = require("./openaiClient");

function fallbackAnalysis({ companySignals, decisionMakers, input, searchStrategy }) {
  const primaryDM = decisionMakers[0];
  const reasons = [];

  if (companySignals.hiring) {
    reasons.push("Active hiring indicates budget and urgency for change.");
  }

  if (primaryDM && primaryDM.recentPost) {
    reasons.push("Decision-maker is publicly talking about growth and efficiency.");
  }

  if (input.geography && input.geography !== "Unknown") {
    reasons.push(`Regional relevance included for ${input.geography}.`);
  }

  return {
    accountPriority: "High",
    outreachAngle: "Support scale-up while reducing execution risk",
    keyReasons: reasons,
    bestChannels: ["Email", "LinkedIn"],
    signalSummary: `Prioritize ${searchStrategy?.primaryPersonaFocus || "commercial leadership"} with a growth-efficiency story.`,
    recommendation:
      "Lead with one business outcome, one social proof line, and a clear low-friction CTA."
  };
}

async function analyzeSignals({ company, decisionMakers, companySignals, searchStrategy, input }) {
  if (!hasOpenAIKey()) {
    markFallback("Signal analysis used fallback: key missing");
    return fallbackAnalysis({ companySignals, decisionMakers, input, searchStrategy });
  }

  const prompt = `
Return exactly valid JSON:
{
  "accountPriority": "High|Medium|Low",
  "outreachAngle": "string",
  "keyReasons": ["string", "string"],
  "bestChannels": ["string"],
  "signalSummary": "string",
  "recommendation": "string"
}

Context:
- Company: ${company.name}
- Industry: ${company.industry}
- Company size: ${input.companySize || "Unknown"}
- Geography: ${input.geography || "Unknown"}
- Decision makers: ${JSON.stringify(decisionMakers)}
- Company signals: ${JSON.stringify(companySignals)}
- Search strategy: ${JSON.stringify(searchStrategy)}

Task:
- Create practical sales intelligence insights.
- Avoid fluff, keep reasons specific.
`;

  try {
    const result = await callWithOpenAI({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt
    });

    if (!result.ok) {
      markFallback(`Signal analysis fallback: ${result.error.message}`);
      return fallbackAnalysis({ companySignals, decisionMakers, input });
    }

    const parsed = safeJsonParse(result.completion.output_text || "");
    if (parsed?.accountPriority && parsed?.outreachAngle && Array.isArray(parsed?.keyReasons)) {
      return {
        accountPriority: parsed.accountPriority,
        outreachAngle: parsed.outreachAngle,
        keyReasons: parsed.keyReasons,
        bestChannels: Array.isArray(parsed.bestChannels) ? parsed.bestChannels : ["Email"],
        signalSummary: parsed.signalSummary || "Signals synthesized from account context.",
        recommendation: parsed.recommendation || "Use a low-friction CTA."
      };
    }
  } catch (_err) {
    // Intentional fallback for resiliency.
  }

  markFallback("Signal analysis output parsing failed");
  return fallbackAnalysis({ companySignals, decisionMakers, input, searchStrategy });
}

module.exports = {
  analyzeSignals
};
