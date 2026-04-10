function normalize(value) {
  const text = (value || "").toString().trim();
  return text || "Unknown";
}

function inferRegionsFromText(text) {
  const lower = (text || "").toLowerCase();
  const regions = [];

  const regionMap = [
    ["North America", ["north america", "usa", "u.s.", "united states", "canada", "mexico"]],
    ["EMEA", ["emea", "europe", "uk", "united kingdom", "germany", "france", "dublin"]],
    ["APAC", ["apac", "asia", "singapore", "india", "australia", "japan"]],
    ["LATAM", ["latam", "latin america", "brazil", "mexico", "colombia", "argentina"]]
  ];

  regionMap.forEach(([region, keywords]) => {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      regions.push(region);
    }
  });

  return regions;
}

function buildCompanyFootprint({ company, input, linkedinSignals, companySignals }) {
  const combinedText = [
    company.websiteSummary?.textSnippet,
    company.websiteSummary?.description,
    companySignals?.messagingSignals?.join(" "),
    linkedinSignals?.locationSignals?.join(" "),
    input.geography
  ]
    .filter(Boolean)
    .join(" ");

  const inferredRegions = inferRegionsFromText(combinedText);
  const geography = normalize(input.geography);
  const primaryRegion = geography === "Unknown" ? inferredRegions[0] || "Unknown" : geography;
  const fallbackRegions = inferredRegions.length ? inferredRegions : [primaryRegion].filter(Boolean);

  const currentRegions = [...new Set([primaryRegion, ...fallbackRegions])].filter(Boolean);

  const marketFootprint = currentRegions.map((region, index) => ({
    region,
    status: index === 0 ? "core" : "adjacent",
    evidence: [
      ...(linkedinSignals?.locationSignals || []).slice(0, 2),
      companySignals?.hiringTrend || "No hiring trend available"
    ].filter(Boolean),
    confidence: index === 0 ? "medium" : "low"
  }));

  return {
    headquartersHypothesis: geography,
    currentRegions,
    marketFootprint,
    expansionSignals: [
      ...(linkedinSignals?.intentSignals || []).map((signal) => signal.label),
      ...(companySignals?.growthKeywords || []).slice(0, 3)
    ].filter(Boolean),
    regionalPriorityFramework: [
      "Core region: where the company already has messaging or hiring activity",
      "Adjacent region: where public hiring or employee locations suggest buildout",
      "Expansion region: where the footprint is not visible yet but the target market is attractive"
    ]
  };
}

module.exports = {
  buildCompanyFootprint
};
