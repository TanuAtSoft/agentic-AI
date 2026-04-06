const { resolveCompany } = require("../services/resolveCompany");
const { planSearchStrategy } = require("../services/planSearchStrategy");
const { findDecisionMakers } = require("../services/findDecisionMakers");
const { getCompanySignals } = require("../services/getCompanySignals");
const { analyzeSignals } = require("../services/analyzeSignals");
const { generatePersonalizedContent } = require("../services/generatePersonalizedContent");

async function leadPipeline(input) {
  const searchStrategy = planSearchStrategy(input);
  const company = await resolveCompany(input.companyName, input);
  const decisionMakers = await findDecisionMakers(company, input, searchStrategy);
  const companySignals = await getCompanySignals(company, input, searchStrategy);
  const insights = await analyzeSignals({
    company,
    decisionMakers,
    companySignals,
    searchStrategy,
    input
  });
  const personalizedMessage = await generatePersonalizedContent({
    company,
    decisionMakers,
    companySignals,
    insights,
    searchStrategy,
    input
  });

  return {
    input,
    searchStrategy,
    company,
    decisionMakers,
    companySignals,
    insights,
    personalizedMessage,
    executionSummary: {
      sourcesUsed: [
        company.source,
        ...searchStrategy.sourcePlan.map((source) => `${source.name} (${source.status})`)
      ],
      limitations: [
        "Decision-makers are inferred from public context in this POC.",
        "LinkedIn is treated as a planned research surface, not directly scraped.",
        "Signal quality improves when the company website has accessible public content."
      ]
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  leadPipeline
};
