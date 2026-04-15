const { callWithOpenAIRequest, hasOpenAIKey, extractJsonObject } = require("./openaiClient");
const { fetchHunterDomainSearch } = require("./hunterDomainSearch");
const { resolveCompany } = require("./resolveCompany");
const { fetchApolloCompanySignals, hasApolloApiKey } = require("./apolloCompanyEnrich");

const HUNTER_DECISION_KEYWORDS = [
  "ceo",
  "chief executive",
  "founder",
  "co-founder",
  "cto",
  "chief technology",
  "coo",
  "chief operating",
  "cfo",
  "chief financial",
  "cmo",
  "chief marketing",
  "vp",
  "vice president",
  "head",
  "director",
  "president",
  "general manager"
];

const DEFAULT_INCLUDED_ROLE_KEYWORDS = [
  "ceo",
  "chief executive officer",
  "founder",
  "co-founder",
  "cto",
  "chief technology officer",
  "cfo",
  "chief financial officer",
  "coo",
  "chief operating officer",
  "cmo",
  "chief marketing officer",
  "cio",
  "chief information officer",
  "president",
  "managing director",
  "director",
  "vice president",
  "vp",
  "head of",
  "head",
  "general manager",
  "gm"
];

const DEFAULT_EXCLUDED_ROLE_KEYWORDS = [
  "intern",
  "trainee",
  "assistant",
  "associate",
  "coordinator",
  "specialist",
  "analyst",
  "entry level",
  "junior",
  "staff"
];

function normalizeText(value) {
  return value == null ? "" : `${value}`.trim();
}

function normalizeKeywordList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map(normalizeText)
      .filter(Boolean);
  }

  return fallback.slice();
}

function normalizeEmployeeCountRange(value) {
  if (!value) {
    return {
      mode: "any",
      min: "",
      max: ""
    };
  }

  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    const numbers = text.match(/\d+(?:,\d{3})*/g)?.map((number) => number.replace(/,/g, "")) || [];

    if (text.includes("between") && numbers.length >= 2) {
      return { mode: "between", min: numbers[0], max: numbers[1] };
    }

    if ((text.includes("less") || text.includes("under")) && numbers.length >= 1) {
      return { mode: "lt", min: "", max: numbers[0] };
    }

    if ((text.includes("greater") || text.includes("over") || text.includes("more")) && numbers.length >= 1) {
      return { mode: "gt", min: numbers[0], max: "" };
    }
  }

  if (typeof value === "object") {
    const mode = normalizeText(value.mode).toLowerCase() || "any";
    return {
      mode: ["lt", "gt", "between"].includes(mode) ? mode : "any",
      min: normalizeText(value.min || value.from || value.low),
      max: normalizeText(value.max || value.to || value.high)
    };
  }

  return {
    mode: "any",
    min: "",
    max: ""
  };
}

function parseNumericValue(value) {
  const text = normalizeText(value).replace(/,/g, "");
  if (!text) {
    return null;
  }

  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEmployeeCountRangeText(value) {
  const text = normalizeText(value).toLowerCase().replace(/,/g, "");
  if (!text) {
    return { min: null, max: null };
  }

  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2])
    };
  }

  const plusMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:\+|plus)/);
  if (plusMatch) {
    const min = Number(plusMatch[1]);
    return {
      min,
      max: Number.POSITIVE_INFINITY
    };
  }

  const single = parseNumericValue(text);
  if (single == null) {
    return { min: null, max: null };
  }

  return {
    min: single,
    max: single
  };
}

function matchesEmployeeCountRange(employeeCount, range) {
  if (!range || range.mode === "any") {
    return true;
  }

  const rowRange = parseEmployeeCountRangeText(employeeCount);
  if (rowRange.min == null && rowRange.max == null) {
    return true;
  }

  const min = parseNumericValue(range.min);
  const max = parseNumericValue(range.max);

  if (range.mode === "lt") {
    if (max == null) {
      return true;
    }
    return rowRange.min == null ? true : rowRange.min < max;
  }

  if (range.mode === "gt") {
    if (min == null) {
      return true;
    }
    return rowRange.max == null ? true : rowRange.max > min;
  }

  if (min == null || max == null) {
    return true;
  }

  return rowRange.max >= min && rowRange.min <= max;
}

function normalizeSearchRow(search = {}, index = 0) {
  const employeeCountRange = normalizeEmployeeCountRange(
    search.employeeCountRange || {
      mode: search.employeeCountMode,
      min: search.employeeCountMin,
      max: search.employeeCountMax
    }
  );

  const row = {
    id: normalizeText(search.id) || `search-${index + 1}`,
    label: normalizeText(search.label) || `Search ${index + 1}`,
    keyword: normalizeText(search.keyword),
    personName: normalizeText(search.personName),
    companyName: normalizeText(search.companyName),
    industry: normalizeText(search.industry),
    location: normalizeText(search.location),
    employeeCountRange,
    notes: normalizeText(search.notes)
  };

  return row;
}

function buildCompanySeed(search) {
  return (
    search.companyName ||
    search.keyword ||
    search.industry ||
    search.personName ||
    "Target Company"
  );
}

async function resolveCompanyContext(search) {
  const company = await resolveCompany(buildCompanySeed(search), {
    industry: search.industry,
    companySize: "",
    geography: search.location
  });

  const apolloSignals = hasApolloApiKey() ? await fetchApolloCompanySignals({ company }) : null;
  const apollo = apolloSignals && apolloSignals.ok ? apolloSignals : null;

  const employeeStrength =
    apollo?.estimatedNumEmployees ??
    apollo?.employeeRange ??
    apollo?.rawEmployeeStrength ??
    "Unavailable";

  const employeeStrengthSource = apollo?.source || "unavailable";

  return {
    ...company,
    source: company.source || "live-website-fetch",
    websiteTitle: company.websiteSummary?.title || "",
    websiteDescription: company.websiteSummary?.description || "",
    websiteSnippet: company.websiteSummary?.textSnippet || "",
    employeeStrength,
    employeeStrengthSource,
    apolloSignals: apollo
  };
}

function normalizeSearches(payload = {}) {
  const searches = Array.isArray(payload.searches) && payload.searches.length
    ? payload.searches
    : [payload];

  const normalized = searches.map((search, index) => normalizeSearchRow(search, index));
  return normalized.filter((search) => {
    return [search.keyword, search.personName, search.companyName, search.industry, search.location, search.notes].some(
      Boolean
    ) || search.employeeCountRange.mode !== "any";
  });
}

function normalizeRoleMapping(roleMapping = {}) {
  const included = normalizeKeywordList(
    roleMapping.included || roleMapping.include || roleMapping.includedTitles,
    DEFAULT_INCLUDED_ROLE_KEYWORDS
  );
  const excluded = normalizeKeywordList(
    roleMapping.excluded || roleMapping.exclude || roleMapping.excludedTitles,
    DEFAULT_EXCLUDED_ROLE_KEYWORDS
  );

  return {
    included: included.length ? included : DEFAULT_INCLUDED_ROLE_KEYWORDS.slice(),
    excluded: excluded.length ? excluded : DEFAULT_EXCLUDED_ROLE_KEYWORDS.slice()
  };
}

function summarizeEmployeeRange(range) {
  if (!range || range.mode === "any") {
    return "any employee count";
  }

  if (range.mode === "lt") {
    return `less than ${range.max || "any"}`;
  }

  if (range.mode === "gt") {
    return `greater than ${range.min || "any"}`;
  }

  return `between ${range.min || "any"} and ${range.max || "any"}`;
}

function buildSearchSummary(search) {
  const parts = [];

  if (search.keyword) {
    parts.push(`keyword "${search.keyword}"`);
  }
  if (search.personName) {
    parts.push(`person "${search.personName}"`);
  }
  if (search.companyName) {
    parts.push(`company "${search.companyName}"`);
  }
  if (search.industry) {
    parts.push(`industry "${search.industry}"`);
  }
  if (search.location) {
    parts.push(`location "${search.location}"`);
  }
  if (search.employeeCountRange.mode !== "any") {
    parts.push(`employee count ${summarizeEmployeeRange(search.employeeCountRange)}`);
  }

  return parts.length ? parts.join(", ") : "unspecified criteria";
}

function buildSearchPrompt(search, roleMapping, limit, companyContext = null) {
  return [
    "You are helping build a lead-search results table for a B2B prospecting app.",
    "Use web search to find public decision-maker profiles that match the criteria.",
    "Return only valid JSON and do not wrap the answer in markdown.",
    "",
    "Required JSON schema:",
    "{",
    '  "results": [',
    "    {",
    '      "personName": "string",',
    '      "designation": "string",',
    '      "department": "string",',
    '      "companyName": "string",',
    '      "companyWebsite": "string",',
    '      "linkedinProfile": "string",',
    '      "phoneNumber": "string",',
    '      "emailId": "string",',
    '      "location": "string",',
    '      "employeeCount": "string",',
    '      "confidence": "high|medium|low",',
    '      "sourceUrl": "string",',
    '      "sourceNote": "string"',
    "    }",
    "  ],",
    '  "searchSummary": "string"',
    "}",
    "",
    `Return at most ${limit} rows.`,
    companyContext?.website
      ? `Resolved company website: ${companyContext.website}.`
      : "Resolved company website: unavailable.",
    companyContext?.websiteTitle
      ? `Website title: ${companyContext.websiteTitle}.`
      : "Website title: unavailable.",
    companyContext?.employeeStrength !== "Unavailable"
      ? `Employee strength: ${companyContext.employeeStrength}.`
      : "Employee strength: unavailable.",
    "Only include decision-makers such as C-level executives, founders, directors, vice presidents, heads of department, and general managers.",
    "Exclude interns, trainees, entry-level staff, junior staff, and mid-level non-decision roles.",
    `Allowed titles include: ${roleMapping.included.join(", ")}.`,
    `Exclude titles matching: ${roleMapping.excluded.join(", ")}.`,
    "",
    `Search criteria: ${buildSearchSummary(search)}.`,
    `Notes from the user: ${search.notes || "none"}.`,
    "If a field is unknown, use an empty string.",
    "If the search criteria are broad, prefer the most senior and relevant matches.",
    "Prefer profiles that can be matched to the requested employee-count range when company size is available.",
    "Prefer public sources that reveal the person, role, company, and one of email, phone, or LinkedIn."
  ].join("\n");
}

function normalizeConfidence(value) {
  const text = normalizeText(value).toLowerCase();
  if (["high", "medium", "low"].includes(text)) {
    return text;
  }
  return "medium";
}

function hasDecisionMakerRole(title, roleMapping) {
  const text = normalizeText(title).toLowerCase();
  if (!text) {
    return false;
  }

  if (roleMapping.excluded.some((term) => matchesTitleTerm(text, term))) {
    return false;
  }

  return roleMapping.included.some((term) => matchesTitleTerm(text, term));
}

function matchesTitleTerm(title, term) {
  const normalizedTerm = normalizeText(term).toLowerCase();
  if (!normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(" ")) {
    return title.includes(normalizedTerm);
  }

  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(title);
}

function scoreHunterContactMatch(decisionMaker, contact) {
  const dmName = normalizeText(decisionMaker.name).toLowerCase();
  const dmTitle = normalizeText(decisionMaker.title).toLowerCase();
  const contactName = normalizeText(contact.name).toLowerCase();
  const contactTitle = normalizeText(contact.title).toLowerCase();

  let score = Number(contact.confidence || 0);

  if (dmName && contactName && dmName === contactName) {
    score += 100;
  } else if (dmName && contactName && (dmName.includes(contactName) || contactName.includes(dmName))) {
    score += 60;
  }

  if (dmTitle && contactTitle && dmTitle === contactTitle) {
    score += 50;
  } else if (dmTitle && contactTitle && (dmTitle.includes(contactTitle) || contactTitle.includes(dmTitle))) {
    score += 25;
  }

  score += scoreTitleOverlap(dmTitle, contactTitle) * 15;

  if (isDecisionMakerTitle(contactTitle, contact.seniority)) {
    score += 10;
  }

  return score;
}

function isDecisionMakerTitle(title, seniority) {
  const text = `${title || ""} ${seniority || ""}`.toLowerCase();
  return HUNTER_DECISION_KEYWORDS.some((keyword) => text.includes(keyword));
}

function scoreTitleOverlap(a, b) {
  const left = normalizeText(a).toLowerCase();
  const right = normalizeText(b).toLowerCase();

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 5;
  }

  const keywords = [
    "ceo",
    "chief executive",
    "founder",
    "co-founder",
    "cto",
    "chief technology",
    "coo",
    "chief operating",
    "cfo",
    "chief financial",
    "cmo",
    "chief marketing",
    "vp",
    "vice president",
    "head",
    "director",
    "president",
    "general manager"
  ];

  return keywords.reduce((score, keyword) => {
    const hit = left.includes(keyword) && right.includes(keyword);
    return hit ? score + 1 : score;
  }, 0);
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function emailLooksLikeItBelongsToPerson(email, personName) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeText(personName).toLowerCase();
  if (!normalizedEmail || !normalizedName) {
    return false;
  }

  const localPart = normalizedEmail.split("@")[0].replace(/[^a-z0-9]/g, "");
  const nameTokens = normalizedName
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (!localPart || !nameTokens.length) {
    return false;
  }

  return nameTokens.some((token) => localPart.includes(token));
}

function pickFirst(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeResultRow(row, search, index, sourceMode, companyContext = null) {
  const designation = pickFirst(row.designation, row.title, row.jobTitle);
  return {
    id: `${search.id}-${index + 1}`,
    searchId: search.id,
    searchLabel: search.label,
    keyword: search.keyword,
    personName: pickFirst(row.personName, row.name, row.fullName),
    designation,
    department: pickFirst(row.department, row.function, row.team),
    companyName: pickFirst(row.companyName, row.organization, companyContext?.name, search.companyName),
    companyWebsite: pickFirst(row.companyWebsite, row.website, row.domain, companyContext?.website),
    linkedinProfile: pickFirst(row.linkedinProfile, row.linkedinUrl, row.profileUrl),
    phoneNumber: pickFirst(row.phoneNumber, row.phone, row.mobile),
    emailId: pickFirst(row.emailId, row.email, row.workEmail),
    location: pickFirst(row.location, row.city, row.region, search.location),
    employeeCount: pickFirst(
      row.employeeCount,
      row.companySize,
      companyContext?.employeeStrength,
      companyContext?.apolloSignals?.employeeRange
    ),
    confidence: normalizeConfidence(row.confidence),
    sourceUrl: pickFirst(row.sourceUrl, row.source, row.url),
    sourceNote: pickFirst(row.sourceNote, row.evidence, row.note, sourceMode),
    sourceMode,
    criteria: {
      companyName: search.companyName,
      industry: search.industry,
      location: search.location,
      employeeCountRange: search.employeeCountRange
    },
    companyContext: companyContext
      ? {
          name: companyContext.name || "",
          website: companyContext.website || "",
          websiteTitle: companyContext.websiteTitle || "",
          websiteDescription: companyContext.websiteDescription || "",
          websiteSnippet: companyContext.websiteSnippet || "",
          employeeStrength: companyContext.employeeStrength || "Unavailable",
          employeeStrengthSource: companyContext.employeeStrengthSource || "unavailable",
          source: companyContext.source || "live-website-fetch",
          apolloSignals: companyContext.apolloSignals || null
        }
      : null
  };
}

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = [
      row.emailId || "",
      row.linkedinProfile || "",
      row.personName || "",
      row.companyName || "",
      row.designation || ""
    ]
      .map((value) => value.trim().toLowerCase())
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function fallbackSearchRows(search, limit, companyContext = null) {
  const baseCompany =
    companyContext?.name ||
    search.companyName ||
    search.keyword ||
    search.industry ||
    search.personName ||
    "Target Company";
  const seedNames = [
    "Ava",
    "Noah",
    "Maya",
    "Ethan",
    "Sophia",
    "Lucas",
    "Isha",
    "Arjun"
  ];
  const titles = [
    "Chief Executive Officer",
    "Founder",
    "Vice President of Sales",
    "Head of Operations",
    "Director of Revenue"
  ];

  return Array.from({ length: Math.min(limit, 5) }, (_item, index) => {
    const title = titles[index % titles.length];
    return normalizeResultRow(
      {
        personName: `${seedNames[index % seedNames.length]} ${baseCompany.split(" ")[0]}`.trim(),
        designation: title,
        department: title.includes("Sales")
          ? "Sales"
          : title.includes("Operations")
            ? "Operations"
            : title.includes("Revenue")
              ? "Revenue"
              : "Executive Leadership",
        companyName: companyContext?.name || baseCompany,
        companyWebsite: companyContext?.website || (search.companyName ? `https://www.${search.companyName.replace(/\s+/g, "").toLowerCase()}.com` : ""),
        linkedinProfile: `https://www.linkedin.com/in/${baseCompany.replace(/[^a-z0-9]/gi, "").toLowerCase()}-${index + 1}`,
        phoneNumber: "",
        emailId: "",
        location: search.location || "",
        employeeCount: "",
        confidence: index === 0 ? "high" : "medium",
        sourceUrl: "fallback-generated",
        sourceNote: "Generated locally because live search was unavailable"
      },
      search,
      index,
      "fallback-generated",
      companyContext
    );
  });
}

async function searchWithOpenAI(search, roleMapping, limit, companyContext = null) {
  const request = {
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5",
    tools: [{ type: "web_search" }],
    input: buildSearchPrompt(search, roleMapping, limit, companyContext)
  };

  const result = await callWithOpenAIRequest(request);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error?.message || "OpenAI web search failed"
    };
  }

  const text = result.completion?.output_text || "";
  const parsed = extractJsonObject(text);
  const rawRows = Array.isArray(parsed?.results)
    ? parsed.results
    : Array.isArray(parsed?.leads)
      ? parsed.leads
      : Array.isArray(parsed?.contacts)
        ? parsed.contacts
        : [];

  const rows = rawRows
    .map((row, index) => normalizeResultRow(row || {}, search, index, "openai-web-search", companyContext))
    .filter((row) => hasDecisionMakerRole(row.designation, roleMapping));

  return {
    ok: true,
    rows,
    summary: normalizeText(parsed?.searchSummary) || "Search completed with web search"
  };
}

function normalizeWebsite(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `https://${text.replace(/^www\./i, "")}`;
}

async function enrichWithHunter(rows) {
  if (!rows.length) {
    return rows;
  }

  const uniqueTargets = new Map();

  for (const row of rows) {
    const website = normalizeWebsite(row.companyWebsite);
    if (!website) {
      continue;
    }

    const key = website.toLowerCase();
    if (!uniqueTargets.has(key)) {
      uniqueTargets.set(key, {
        website,
        companyName: row.companyName
      });
    }
  }

  if (!uniqueTargets.size) {
    return rows;
  }

  const hunterResults = new Map();

  await Promise.all(
    Array.from(uniqueTargets.values()).map(async (target) => {
      const search = await fetchHunterDomainSearch({
        website: target.website,
        companyName: target.companyName
      });

      if (search.ok) {
        hunterResults.set(target.website.toLowerCase(), search);
      }
    })
  );

  if (!hunterResults.size) {
    return rows;
  }

  const usedHunterEmailsByCompany = new Map();

  return rows.map((row) => {
    const website = normalizeWebsite(row.companyWebsite);
    const hunterSearch = hunterResults.get(website.toLowerCase());
    if (!hunterSearch?.decisionMakerContacts?.length) {
      return row;
    }

    let bestMatch = null;
    let bestScore = -1;
    const usedEmails = usedHunterEmailsByCompany.get(website.toLowerCase()) || new Set();
    const existingEmail = normalizeEmail(row.emailId);

    for (const contact of hunterSearch.decisionMakerContacts) {
      const contactEmail = normalizeEmail(contact.email);
      if (usedEmails.has(contactEmail)) {
        continue;
      }

      const score = scoreHunterContactMatch(row, contact);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = contact;
      }
    }

    const bestEmail = normalizeEmail(bestMatch?.email);
    const bestEmailBelongsToRow = bestEmail && emailLooksLikeItBelongsToPerson(bestEmail, row.personName);
    const existingEmailBelongsToRow = existingEmail && emailLooksLikeItBelongsToPerson(existingEmail, row.personName);

    const hasStrongHunterMatch = Boolean(bestMatch && bestScore >= 85 && bestEmail && bestEmailBelongsToRow);
    const resolvedEmail = hasStrongHunterMatch && !usedEmails.has(bestEmail)
      ? bestMatch.email
      : existingEmailBelongsToRow && !usedEmails.has(existingEmail)
        ? row.emailId
        : "";

    if (resolvedEmail) {
      usedEmails.add(normalizeEmail(resolvedEmail));
    }
    usedHunterEmailsByCompany.set(website.toLowerCase(), usedEmails);

    if (!hasStrongHunterMatch) {
      return {
        ...row,
        emailId: resolvedEmail,
        sourceNote: row.sourceNote || "Hunter enrichment applied"
      };
    }

    return {
      ...row,
      emailId: resolvedEmail,
      phoneNumber: row.phoneNumber || bestMatch.phoneNumber || "",
      linkedinProfile: row.linkedinProfile || bestMatch.linkedinUrl || "",
      department: row.department || bestMatch.department || "",
      sourceNote: row.sourceNote || "Hunter enrichment applied"
    };
  });
}

async function searchDecisionMakerLeads(payload = {}) {
  const searches = normalizeSearches(payload);
  if (!searches.length) {
    return {
      ok: false,
      status: 400,
      error: "At least one search input is required."
    };
  }

  const roleMapping = normalizeRoleMapping(payload.roleMapping || {});
  const maxResultsPerSearch = Math.max(
    1,
    Math.min(Number(payload.maxResultsPerSearch || payload.limit || 10), 25)
  );

  const allRows = [];
  const searchLogs = [];
  const companyContexts = [];

  for (const [index, search] of searches.entries()) {
    const companyContext = await resolveCompanyContext(search);
    companyContexts.push({
      searchId: search.id,
      label: search.label,
      ...companyContext
    });

    if (hasOpenAIKey()) {
      const response = await searchWithOpenAI(search, roleMapping, maxResultsPerSearch, companyContext);
      if (response.ok) {
        allRows.push(...response.rows);
        searchLogs.push({
          id: search.id,
          label: search.label,
          summary: response.summary,
          mode: "openai-web-search",
          resultCount: response.rows.length,
          criteria: search
        });
        continue;
      }
    }

    const fallbackRows = fallbackSearchRows(search, maxResultsPerSearch, companyContext);
    allRows.push(...fallbackRows);
    searchLogs.push({
      id: search.id,
      label: search.label,
      summary: "Generated fallback rows locally",
      mode: "fallback-generated",
      resultCount: fallbackRows.length,
      criteria: search
    });
  }

  const enrichedRows = await enrichWithHunter(allRows);
  const filteredRows = dedupeRows(
    enrichedRows.filter((row) =>
      hasDecisionMakerRole(row.designation, roleMapping) &&
      matchesEmployeeCountRange(row.employeeCount, row.criteria?.employeeCountRange)
    )
  ).slice(0, Math.max(maxResultsPerSearch * searches.length, 1));
  const sourceMode = searchLogs.some((log) => log.mode === "openai-web-search")
    ? "openai-web-search"
    : "fallback-generated";

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    sourceMode,
    roleMapping,
    searchLogs,
    companyContexts,
    searchCount: searches.length,
    totalResults: filteredRows.length,
    results: filteredRows,
    appliedFilters: {
      keywords: normalizeKeywordList(payload.keywords || payload.keyword),
      industries: normalizeKeywordList(payload.industries || payload.industry),
      locations: normalizeKeywordList(payload.locations || payload.location)
    }
  };
}

module.exports = {
  DEFAULT_INCLUDED_ROLE_KEYWORDS,
  DEFAULT_EXCLUDED_ROLE_KEYWORDS,
  searchDecisionMakerLeads
};
