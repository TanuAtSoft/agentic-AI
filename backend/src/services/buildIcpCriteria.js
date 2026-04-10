function normalizeText(value, fallback = "Unknown") {
  const text = (value || "").toString().trim();
  return text || fallback;
}

function chooseCoreFunctions(industry) {
  const lower = (industry || "").toLowerCase();

  if (lower.includes("saas") || lower.includes("software") || lower.includes("technology")) {
    return ["Revenue Operations", "Sales Leadership", "Marketing Operations"];
  }

  if (lower.includes("health")) {
    return ["Operations", "Digital Transformation", "Clinical Operations"];
  }

  if (lower.includes("finance") || lower.includes("fintech")) {
    return ["Risk", "Operations", "Growth"];
  }

  return ["Operations", "Growth", "Technology"];
}

function chooseTargetSegments({ company, input, linkedinSignals, companySignals }) {
  const industry = normalizeText(company.industry, "General B2B");
  const size = normalizeText(input.companySize, "Unknown");
  const geography = normalizeText(input.geography, "Global");
  const intentSignals = linkedinSignals?.intentSignals || [];
  const hiringSignals = companySignals?.openRoles || [];

  return [
    {
      name: "Primary ICP",
      priority: "high",
      fit: "Best-fit accounts with active growth or hiring motion",
      criteria: [
        `Industry matches ${industry}`,
        `Company size sits in ${size}`,
        `Geography includes ${geography}`,
        "Public hiring or expansion signals are present"
      ],
      targetFunctions: chooseCoreFunctions(industry),
      triggerSignals: [
        ...intentSignals.map((signal) => signal.label),
        ...hiringSignals.slice(0, 3)
      ].slice(0, 5),
      disqualifiers: [
        "No public growth signal",
        "Very small footprint with no hiring motion",
        "No evidence of change initiative"
      ]
    },
    {
      name: "Secondary ICP",
      priority: "medium",
      fit: "Adjacent accounts that are growing but may need more education",
      criteria: [
        `Industry-adjacent to ${industry}`,
        "Moderate hiring or modernization language",
        "At least one regional expansion cue"
      ],
      targetFunctions: ["Operations", "Business Strategy", "Revenue"],
      triggerSignals: ["regional_expansion", "commercial_push", "operational_modernization"],
      disqualifiers: ["Static messaging", "No expansion or hiring clues"]
    },
    {
      name: "Expansion ICP",
      priority: "medium",
      fit: "Accounts in regions or subsidiaries where footprint is spreading",
      criteria: [
        `Regional footprint extends beyond ${geography}`,
        "Multiple offices, markets, or hiring locations",
        "Localized growth or launch activity"
      ],
      targetFunctions: ["Regional Leadership", "Operations", "Sales Leadership"],
      triggerSignals: ["regional_expansion", "headcount_growth", "multi_location_presence"],
      disqualifiers: ["Single-location footprint", "No regional motion"]
    }
  ];
}

function buildIcpCriteria({ company, input, linkedinSignals, companySignals }) {
  const segments = chooseTargetSegments({ company, input, linkedinSignals, companySignals });

  return {
    finalizedICP: {
      companyName: company.name,
      industry: normalizeText(company.industry, "General B2B"),
      sizeBand: normalizeText(input.companySize, "Unknown"),
      geography: normalizeText(input.geography, "Global"),
      buyingMotion: "Growth-oriented accounts with active hiring, modernization, or expansion signals",
      coreFunctions: chooseCoreFunctions(company.industry),
      keyFilters: [
        "Public hiring momentum",
        "Regional expansion cues",
        "Technology or workflow modernization language",
        "Clear executive ownership for change"
      ]
    },
    targetSegments: segments
  };
}

module.exports = {
  buildIcpCriteria
};
