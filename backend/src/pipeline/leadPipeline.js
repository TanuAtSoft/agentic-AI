const { resolveCompany } = require("../services/resolveCompany");
const { planSearchStrategy } = require("../services/planSearchStrategy");
const { findDecisionMakers } = require("../services/findDecisionMakers");
const { getCompanySignals } = require("../services/getCompanySignals");
const { analyzeSignals } = require("../services/analyzeSignals");
const { generatePersonalizedContent } = require("../services/generatePersonalizedContent");
const { fetchApolloCompanySignals } = require("../services/apolloCompanyEnrich");
const { fetchLinkedInCompanySignals } = require("../services/linkedinScraper");
const { fetchIndeedCompanySignals } = require("../services/indeedScraper");
const { fetchCrunchbaseCompanySignals } = require("../services/crunchbaseScraper");
const { fetchHunterDomainSearch, attachHunterEmails } = require("../services/hunterDomainSearch");
const { buildIcpCriteria } = require("../services/buildIcpCriteria");
const { buildCompanyFootprint } = require("../services/mapCompanyFootprint");

async function leadPipeline(input) {
  const searchStrategy = planSearchStrategy(input);
  const company = await resolveCompany(input.companyName, input);
  const hunterSearch = await fetchHunterDomainSearch({
    website: company.website,
    companyName: company.name
  });
  const [apolloSignals, linkedinSignals, indeedSignals, crunchbaseSignals] = await Promise.all([
    fetchApolloCompanySignals({ company, input }),
    fetchLinkedInCompanySignals({ company, input }),
    fetchIndeedCompanySignals({ company, input }),
    fetchCrunchbaseCompanySignals({ company, input })
  ]);

  const hybridSignals = {
    apollo: apolloSignals.ok ? apolloSignals : null,
    linkedin: linkedinSignals.ok ? linkedinSignals : null,
    indeed: indeedSignals.ok ? indeedSignals : null,
    crunchbase: crunchbaseSignals.ok ? crunchbaseSignals : null
  };

  const companySignals = await getCompanySignals(company, input, searchStrategy, hybridSignals);
  const companyWithApollo = {
    ...company,
    employeeStrength: companySignals.employeeStrength,
    employeeStrengthSource: companySignals.employeeStrengthSource,
    apolloEmployeeRange: hybridSignals.apollo?.employeeRange || null
  };
  const icpCriteria = buildIcpCriteria({
    company: companyWithApollo,
    input,
    linkedinSignals: hybridSignals.linkedin,
    companySignals
  });
  const companyFootprint = buildCompanyFootprint({
    company: companyWithApollo,
    input,
    linkedinSignals: hybridSignals.linkedin,
    companySignals
  });
  const decisionMakers = await findDecisionMakers(
    companyWithApollo,
    input,
    searchStrategy,
    hybridSignals.linkedin
  );
  const decisionMakersWithEmails = hunterSearch.ok
    ? attachHunterEmails(decisionMakers, hunterSearch.contacts)
    : decisionMakers;
  const insights = await analyzeSignals({
    company: companyWithApollo,
    decisionMakers: decisionMakersWithEmails,
    companySignals,
    searchStrategy,
    input,
    icpCriteria,
    companyFootprint,
    linkedinSignals: hybridSignals.linkedin
  });
  const personalizedMessage = await generatePersonalizedContent({
    company: companyWithApollo,
    decisionMakers: decisionMakersWithEmails,
    companySignals,
    insights,
    searchStrategy,
    input,
    icpCriteria,
    companyFootprint,
    linkedinSignals: hybridSignals.linkedin
  });

  return {
    input,
    searchStrategy,
    company: companyWithApollo,
    hybridSignals,
    decisionMakers: decisionMakersWithEmails,
    hunterIntelligence: hunterSearch.ok
      ? {
          source: hunterSearch.source,
          domain: hunterSearch.domain,
          organization: hunterSearch.organization,
          pattern: hunterSearch.pattern,
          acceptAll: hunterSearch.acceptAll,
          disposable: hunterSearch.disposable,
          webmail: hunterSearch.webmail,
          totalContacts: hunterSearch.totalContacts,
          totalDecisionMakers: hunterSearch.totalDecisionMakers,
          contacts: hunterSearch.contacts,
          decisionMakerContacts: hunterSearch.decisionMakerContacts,
          decisionMakerEmails: hunterSearch.decisionMakerContacts.map((contact) => ({
            name: contact.name,
            title: contact.title,
            email: contact.email,
            confidence: contact.confidence,
            verificationStatus: contact.verificationStatus,
            linkedinUrl: contact.linkedinUrl
          }))
        }
      : null,
    companySignals,
    icpCriteria,
    companyFootprint,
    insights,
    personalizedMessage,
    executionSummary: {
      sourcesUsed: [
        company.source,
        linkedinSignals.ok
          ? `${linkedinSignals.source} (server-side)`
          : "linkedin-scraper-api (server-side unavailable)",
        apolloSignals.ok
          ? `${apolloSignals.source} (server-side)`
          : "apollo-organization-enrich (server-side unavailable)",
        indeedSignals.ok
          ? `${indeedSignals.source} (server-side)`
          : "indeed-scraper-api (server-side unavailable)",
        crunchbaseSignals.ok
          ? `${crunchbaseSignals.source} (server-side)`
          : "crunchbase-scraper-api (server-side unavailable)",
        hunterSearch.ok
          ? `${hunterSearch.source} (domain search)`
          : "hunter-domain-search (unavailable)",
        ...searchStrategy.sourcePlan.map((source) => `${source.name} (${source.status})`)
      ],
      limitations: [
        "Decision-makers are inferred from public context in this POC.",
        linkedinSignals.ok
          ? "LinkedIn scraping API is connected on the backend and used when available."
          : "LinkedIn scraping API is not configured, so backend LinkedIn signals fall back to heuristics.",
        apolloSignals.ok
          ? "Apollo organization enrichment is connected on the backend and used when available."
          : "Apollo organization enrichment is not configured, so employee strength falls back to other public signals.",
        indeedSignals.ok
          ? "Indeed hiring data is connected on the backend and used when available."
          : "Indeed hiring data is not configured, so backend hiring trends fall back to heuristics.",
        crunchbaseSignals.ok
          ? "Crunchbase funding data is connected on the backend and used when available."
          : "Crunchbase funding data is not configured, so backend funding intent falls back to heuristics.",
        hunterSearch.ok
          ? "Hunter domain search enriches inferred decision makers with domain-based contact emails."
          : "Hunter domain search is not configured, so decision maker emails may be unavailable.",
        "Signal quality improves when the company website has accessible public content."
      ]
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  leadPipeline
};
