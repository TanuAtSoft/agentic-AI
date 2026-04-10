const axios = require("axios");

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
  "owner",
  "partner"
];

function hasHunterApiKey() {
  return Boolean(process.env.HUNTER_API_KEY);
}

function extractDomain(website) {
  if (!website || typeof website !== "string") {
    return "";
  }

  try {
    const normalized = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const url = new URL(normalized);
    return url.hostname.replace(/^www\./i, "").trim().toLowerCase();
  } catch (_error) {
    return website
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .trim()
      .toLowerCase();
  }
}

function normalizeValue(value) {
  return value == null ? "" : `${value}`.trim();
}

function dedupeContacts(contacts) {
  const seen = new Set();

  return (contacts || []).filter((contact) => {
    const key = normalizeValue(contact.email).toLowerCase() || normalizeValue(contact.name).toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeHunterContact(contact) {
  const firstName = normalizeValue(contact.first_name);
  const lastName = normalizeValue(contact.last_name);
  const title = normalizeValue(contact.position_raw || contact.position);
  const email = normalizeValue(contact.value);

  return {
    name: [firstName, lastName].filter(Boolean).join(" ").trim() || email.split("@")[0] || "Unknown",
    firstName,
    lastName,
    title,
    email,
    confidence: Number(contact.confidence || 0),
    seniority: normalizeValue(contact.seniority),
    department: normalizeValue(contact.department),
    linkedinUrl: contact.linkedin || "",
    twitter: contact.twitter || "",
    phoneNumber: contact.phone_number || "",
    verificationStatus: contact.verification?.status || "",
    sources: Array.isArray(contact.sources) ? contact.sources : []
  };
}

function isDecisionMakerTitle(title, seniority) {
  const text = `${title || ""} ${seniority || ""}`.toLowerCase();
  return HUNTER_DECISION_KEYWORDS.some((keyword) => text.includes(keyword));
}

function scoreTitleOverlap(a, b) {
  const left = normalizeValue(a).toLowerCase();
  const right = normalizeValue(b).toLowerCase();

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 5;
  }

  return HUNTER_DECISION_KEYWORDS.reduce((score, keyword) => {
    const hit = left.includes(keyword) && right.includes(keyword);
    return hit ? score + 1 : score;
  }, 0);
}

function attachHunterEmails(decisionMakers, contacts) {
  const rankedContacts = (contacts || []).slice().sort((a, b) => {
    const aScore = Number(a.confidence || 0) + (isDecisionMakerTitle(a.title, a.seniority) ? 20 : 0);
    const bScore = Number(b.confidence || 0) + (isDecisionMakerTitle(b.title, b.seniority) ? 20 : 0);
    return bScore - aScore;
  });

  return (decisionMakers || []).map((decisionMaker) => {
    const dmName = normalizeValue(decisionMaker.name).toLowerCase();
    const dmTitle = normalizeValue(decisionMaker.title).toLowerCase();

    let bestMatch = null;
    let bestScore = -1;

    for (const contact of rankedContacts) {
      let score = Number(contact.confidence || 0);
      const contactName = normalizeValue(contact.name).toLowerCase();
      const contactTitle = normalizeValue(contact.title).toLowerCase();

      if (dmName && contactName && dmName === contactName) {
        score += 100;
      } else if (dmName && contactName && (dmName.includes(contactName) || contactName.includes(dmName))) {
        score += 60;
      }

      score += scoreTitleOverlap(dmTitle, contactTitle) * 15;

      if (isDecisionMakerTitle(contactTitle, contact.seniority)) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = contact;
      }
    }

    return {
      ...decisionMaker,
      email: bestMatch?.email || decisionMaker.email || "",
      emailConfidence: bestMatch?.confidence || null,
      hunterSource: bestMatch ? "hunter-domain-search" : decisionMaker.hunterSource || "",
      hunterMatch: bestMatch
        ? {
            name: bestMatch.name,
            title: bestMatch.title,
            seniority: bestMatch.seniority,
            department: bestMatch.department,
            confidence: bestMatch.confidence
          }
        : null
    };
  });
}

async function fetchHunterDomainSearch({ website, companyName, limit = Number(process.env.HUNTER_DOMAIN_SEARCH_LIMIT || 10) }) {
  if (!hasHunterApiKey()) {
    return {
      ok: false,
      status: 503,
      source: "hunter-domain-search",
      error: "HUNTER_API_KEY not configured"
    };
  }

  const domain = extractDomain(website);

  if (!domain) {
    return {
      ok: false,
      status: 400,
      source: "hunter-domain-search",
      error: "Unable to derive a domain from the company website"
    };
  }

  try {
    const response = await axios.get("https://api.hunter.io/v2/domain-search", {
      params: {
        domain,
        company: companyName,
        limit,
        api_key: process.env.HUNTER_API_KEY
      },
      timeout: Number(process.env.HUNTER_DOMAIN_SEARCH_TIMEOUT_MS || 15000)
    });

    const data = response.data?.data || {};
    const contacts = dedupeContacts((data.emails || []).map(normalizeHunterContact));
    const decisionMakerContacts = contacts.filter((contact) =>
      isDecisionMakerTitle(contact.title, contact.seniority)
    );

    return {
      ok: true,
      source: "hunter-domain-search",
      domain,
      organization: data.organization || companyName || "",
      pattern: data.pattern || "",
      acceptAll: typeof data.accept_all === "boolean" ? data.accept_all : null,
      disposable: typeof data.disposable === "boolean" ? data.disposable : null,
      webmail: typeof data.webmail === "boolean" ? data.webmail : null,
      totalContacts: contacts.length,
      totalDecisionMakers: decisionMakerContacts.length,
      contacts,
      decisionMakerContacts,
      raw: data
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 500,
      source: "hunter-domain-search",
      error: error?.response?.data || error?.message || "Hunter domain search failed"
    };
  }
}

module.exports = {
  hasHunterApiKey,
  fetchHunterDomainSearch,
  attachHunterEmails
};
