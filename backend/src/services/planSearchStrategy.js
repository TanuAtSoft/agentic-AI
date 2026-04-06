function normalizeIndustry(industry) {
  return (industry || "").trim() || "Unknown";
}

function choosePrimaryPersona(industry) {
  const lower = industry.toLowerCase();

  if (lower.includes("saas") || lower.includes("software") || lower.includes("technology")) {
    return "Revenue and go-to-market leadership";
  }

  if (lower.includes("health")) {
    return "Operations and digital transformation leadership";
  }

  if (lower.includes("finance") || lower.includes("fintech")) {
    return "Growth, partnerships, and modernization leadership";
  }

  return "Commercial and operations leadership";
}

function buildSources(companyName, industry, geography) {
  const sources = [
    {
      name: "Company website",
      purpose: `Validate positioning, messaging, and public proof points for ${companyName}.`,
      status: "active"
    },
    {
      name: "Search engine / web results",
      purpose: "Look for press, thought leadership, hiring signals, and category context.",
      status: "active"
    },
    {
      name: "LinkedIn public footprint",
      purpose: "Infer likely senior stakeholders, titles, and social activity patterns.",
      status: "planned"
    }
  ];

  if (geography) {
    sources.push({
      name: "Regional ecosystem signals",
      purpose: `Prioritize market context relevant to ${geography}.`,
      status: "planned"
    });
  }

  if (industry && industry !== "Unknown") {
    sources.push({
      name: "Industry-specific communities",
      purpose: `Check ${industry} language, hiring patterns, and relevant buying triggers.`,
      status: "planned"
    });
  }

  return sources;
}

function planSearchStrategy({ companyName, industry, companySize, geography }) {
  const normalizedIndustry = normalizeIndustry(industry);
  const normalizedSize = (companySize || "").trim() || "Unknown";
  const normalizedGeography = (geography || "").trim() || "Unknown";

  return {
    searchIntent: "Find likely decision-makers, gather account context, detect buying signals, and draft outreach.",
    primaryPersonaFocus: choosePrimaryPersona(normalizedIndustry),
    sourcePlan: buildSources(companyName, normalizedIndustry, geography),
    signalChecklist: [
      "Hiring momentum and open roles",
      "Growth language and expansion clues",
      "Technology or process modernization indicators",
      "Executive or team messaging themes",
      "Regional and industry-specific relevance"
    ],
    filters: {
      companyName,
      industry: normalizedIndustry,
      companySize: normalizedSize,
      geography: normalizedGeography
    }
  };
}

module.exports = {
  planSearchStrategy
};
