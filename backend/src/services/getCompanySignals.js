function rolesByIndustry(industry) {
  const lower = (industry || "").toLowerCase();

  if (lower.includes("software") || lower.includes("saas") || lower.includes("technology")) {
    return ["Backend Engineer", "Solutions Architect", "Product Manager"];
  }

  if (lower.includes("health")) {
    return ["Clinical Operations Manager", "Data Analyst", "Quality Lead"];
  }

  return ["Business Development Manager", "Operations Analyst"];
}

function detectHiringSignals(text) {
  const lower = (text || "").toLowerCase();
  const hiringKeywords = ["careers", "we are hiring", "join our team", "open roles", "jobs"];
  const hasHiringLanguage = hiringKeywords.some((kw) => lower.includes(kw));
  return hasHiringLanguage;
}

function detectGrowthLanguage(text) {
  const lower = (text || "").toLowerCase();
  const growthKeywords = [
    "scale",
    "growing",
    "expanding",
    "faster",
    "modernize",
    "platform",
    "automation",
    "digital transformation"
  ];

  return growthKeywords.filter((keyword) => lower.includes(keyword));
}

function extractRoleCandidates(text, industry) {
  const lower = (text || "").toLowerCase();
  const roleDictionary = [
    "software engineer",
    "product manager",
    "data engineer",
    "account executive",
    "sales development representative",
    "customer success manager",
    "solutions architect",
    "marketing manager"
  ];
  const matched = roleDictionary.filter((role) => lower.includes(role)).map((r) => {
    return r
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  });
  return matched.length ? matched.slice(0, 4) : rolesByIndustry(industry);
}

function detectTechSignals(text) {
  const lower = (text || "").toLowerCase();
  const techKeywords = ["api", "platform", "data", "analytics", "integration", "workflow", "automation"];
  return techKeywords.filter((keyword) => lower.includes(keyword));
}

async function getCompanySignals(company, _input, searchStrategy) {
  const siteText = company.websiteSummary?.textSnippet || "";
  const isHiring = detectHiringSignals(siteText);
  const openRoles = extractRoleCandidates(siteText, company.industry);
  const growthKeywords = detectGrowthLanguage(siteText);
  const techKeywords = detectTechSignals(siteText);

  return {
    hiring: isHiring,
    openRoles,
    growthKeywords,
    techKeywords,
    hiringTrend: isHiring
      ? "Hiring language detected from live company website content"
      : "No explicit hiring language detected on sampled website content",
    growthSignals: [
      company.websiteSummary?.liveFetched
        ? "Live website content fetched for this run"
        : "Website fetch unavailable; using heuristic assumptions",
      isHiring ? "Careers/hiring intent appears in company copy" : "Growth inferred from available context",
      growthKeywords.length
        ? `Growth language detected: ${growthKeywords.join(", ")}`
        : "No strong growth language detected in the sampled website copy"
    ],
    messagingSignals: [
      company.websiteSummary?.description || "No meta description available",
      company.websiteSummary?.title || "No page title available"
    ],
    searchRationale: searchStrategy?.signalChecklist || [],
    dataFreshness: company.websiteSummary?.liveFetched ? "Partially real-time (website-derived)" : "Heuristic"
  };
}

module.exports = {
  getCompanySignals
};
