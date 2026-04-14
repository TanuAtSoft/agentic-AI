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

function extractApolloOrganization(data) {
  return data?.organization || data?.company || data?.account || data?.data?.organization || data;
}

function extractApolloEmployeeStrength(org) {
  const numericStrength =
    org?.estimated_num_employees ??
    org?.estimatedNumEmployees ??
    org?.employee_count ??
    org?.employeeCount ??
    org?.num_employees ??
    org?.numEmployees ??
    null;

  if (numericStrength != null) {
    return toNumber(numericStrength);
  }

  return org?.employee_range || org?.employeeRange || null;
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
    const response = await axios.get("https://api.apollo.io/api/v1/organizations/enrich", {
      params: { domain },
      timeout: Number(process.env.APOLLO_API_TIMEOUT_MS || 12000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
        "Cache-Control": "no-cache"
      }
    });

    const org = extractApolloOrganization(response.data);
    const employeeStrength = extractApolloEmployeeStrength(org);

    return {
      ok: true,
      source: "apollo-organization-enrich",
      provider: "apollo",
      domain,
      organizationName: org?.name || org?.organization_name || company.name || "",
      estimatedNumEmployees: typeof employeeStrength === "number" ? employeeStrength : null,
      employeeRange: org?.employee_range || org?.employeeRange || (typeof employeeStrength === "string" ? employeeStrength : null),
      rawEmployeeStrength: employeeStrength
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
