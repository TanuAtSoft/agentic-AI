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

function normalizeSignals(items) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

async function getCompanySignals(company, _input, searchStrategy, hybridSignals = {}) {
  const siteText = company.websiteSummary?.textSnippet || "";
  const isHiring = detectHiringSignals(siteText);
  const openRoles = extractRoleCandidates(siteText, company.industry);
  const growthKeywords = detectGrowthLanguage(siteText);
  const techKeywords = detectTechSignals(siteText);
  const apolloSignals = hybridSignals.apollo || null;
  const linkedinSignals = hybridSignals.linkedin || null;
  const indeedSignals = hybridSignals.indeed || null;
  const crunchbaseSignals = hybridSignals.crunchbase || null;
  const apolloEmployeeStrengthRaw = apolloSignals?.rawEmployeeStrength ?? null;
  const apolloEmployeeStrength =
    apolloSignals?.estimatedNumEmployees ?? apolloSignals?.estimated_num_employees ?? null;
  const apolloEmployeeRange = apolloSignals?.employeeRange || null;
  const fallbackEmployeeStrength =
    linkedinSignals?.headcount || crunchbaseSignals?.employeeCount || null;
  let employeeStrengthSource = "unavailable";

  if (apolloEmployeeStrength != null) {
    employeeStrengthSource = "apollo";
  } else if (apolloEmployeeRange) {
    employeeStrengthSource = "apollo-range";
  } else if (apolloEmployeeStrengthRaw != null) {
    employeeStrengthSource = "apollo-raw";
  } else if (linkedinSignals?.headcount) {
    employeeStrengthSource = "linkedin";
  } else if (crunchbaseSignals?.employeeCount) {
    employeeStrengthSource = "crunchbase";
  }
  const linkedinIntentSignals = normalizeSignals(linkedinSignals?.intentSignals);
  const indeedHiringSignals = normalizeSignals(indeedSignals?.hiringIntentSignals);
  const crunchbaseFundingSignals = normalizeSignals(crunchbaseSignals?.fundingIntentSignals);

  return {
    hiring: isHiring,
    openRoles,
    growthKeywords,
    techKeywords,
    employeeStrength:
      apolloEmployeeStrength ?? apolloEmployeeRange ?? apolloEmployeeStrengthRaw ?? fallbackEmployeeStrength,
    employeeStrengthSource,
    apolloSignals: {
      source: apolloSignals?.source || "unavailable",
      provider: apolloSignals?.provider || null,
      domain: apolloSignals?.domain || null,
      organizationName: apolloSignals?.organizationName || null,
      estimatedNumEmployees: apolloEmployeeStrength,
      employeeRange: apolloEmployeeRange,
      rawEmployeeStrength: apolloEmployeeStrengthRaw
    },
    linkedinSignals: {
      source: linkedinSignals?.source || "unavailable",
      provider: linkedinSignals?.provider || null,
      headcount: linkedinSignals?.headcount || null,
      recentPosts: normalizeSignals(linkedinSignals?.recentPosts),
      hiringSignals: normalizeSignals(linkedinSignals?.hiringSignals),
      locationSignals: normalizeSignals(linkedinSignals?.locationSignals),
      intentSignals: linkedinIntentSignals
    },
    indeedSignals: {
      source: indeedSignals?.source || "unavailable",
      provider: indeedSignals?.provider || null,
      jobPostings: normalizeSignals(indeedSignals?.jobPostings),
      roleTitles: normalizeSignals(indeedSignals?.roleTitles),
      locations: normalizeSignals(indeedSignals?.locations),
      salaryRanges: normalizeSignals(indeedSignals?.salaryRanges),
      hiringVelocity: indeedSignals?.hiringVelocity || null,
      hiringIntentSignals: indeedHiringSignals
    },
    crunchbaseSignals: {
      source: crunchbaseSignals?.source || "unavailable",
      provider: crunchbaseSignals?.provider || null,
      fundingRounds: normalizeSignals(crunchbaseSignals?.fundingRounds),
      investors: normalizeSignals(crunchbaseSignals?.investors),
      acquisitions: normalizeSignals(crunchbaseSignals?.acquisitions),
      employeeCount: crunchbaseSignals?.employeeCount || null,
      lastFundingDate: crunchbaseSignals?.lastFundingDate || null,
      lastFundingType: crunchbaseSignals?.lastFundingType || null,
      fundingIntentSignals: crunchbaseFundingSignals
    },
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
    linkedinIntentSummary: linkedinIntentSignals.length
      ? linkedinIntentSignals.map((signal) => signal.description).filter(Boolean)
      : ["No LinkedIn scraping data available yet"],
    indeedHiringSummary: indeedHiringSignals.length
      ? indeedHiringSignals.map((signal) => signal.description).filter(Boolean)
      : ["No Indeed hiring data available yet"],
    crunchbaseFundingSummary: crunchbaseFundingSignals.length
      ? crunchbaseFundingSignals.map((signal) => signal.description).filter(Boolean)
      : ["No Crunchbase funding data available yet"],
    searchRationale: searchStrategy?.signalChecklist || [],
    dataFreshness: company.websiteSummary?.liveFetched ? "Partially real-time (website-derived)" : "Heuristic"
  };
}

module.exports = {
  getCompanySignals
};
