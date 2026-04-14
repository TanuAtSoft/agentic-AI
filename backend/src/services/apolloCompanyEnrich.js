const axios = require("axios");

function hasApolloApiKey() {
  return Boolean(process.env.APOLLO_API_KEY || process.env.APOLLO_MASTER_KEY);
}

function getApolloIntegrationMode() {
  return hasApolloApiKey() ? "apollo-api" : "unconfigured";
}

function assertServerSide() {
  if (typeof window !== "undefined") {
    throw new Error("Apollo enrichment must be called from the server side.");
  }
}

function extractDomain(website) {
  if (!website) {
    return null;
  }

  try {
    const normalizedWebsite = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(normalizedWebsite).hostname.replace(/^www\./i, "");
  } catch (_error) {
    return null;
  }
}

function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

async function fetchApolloCompanySignals({ company }) {
  assertServerSide();

  const apiKey = process.env.APOLLO_API_KEY || process.env.APOLLO_MASTER_KEY || "";
  const domain = extractDomain(company.website);

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      source: "apollo-organization-enrich",
      error: "Apollo API key not set"
    };
  }

  if (!domain) {
    return {
      ok: false,
      status: 400,
      source: "apollo-organization-enrich",
      error: "Unable to derive a company domain for Apollo enrichment"
    };
  }

  try {
    const response = await axios.get("https://api.apollo.io/v1/organizations/enrich", {
      params: { domain },
      timeout: Number(process.env.APOLLO_API_TIMEOUT_MS || 12000),
      headers: {
        "X-Api-Key": apiKey
      }
    });

    const org = response.data?.organization || {};

    return {
      ok: true,
      source: "apollo-organization-enrich",
      provider: "apollo",
      domain,
      organizationName: org.name || company.name || "",
      estimatedNumEmployees: toNumber(org.estimated_num_employees),
      employeeRange: org.employee_range || null
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 500,
      source: "apollo-organization-enrich",
      error: error?.response?.data || error?.message || "Apollo organization enrichment failed"
    };
  }
}

module.exports = {
  hasApolloApiKey,
  getApolloIntegrationMode,
  fetchApolloCompanySignals
};
