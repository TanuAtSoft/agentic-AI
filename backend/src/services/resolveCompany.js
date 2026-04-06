const axios = require("axios");

const slugifyCompany = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "");

function extractSiteSummary(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const descriptionMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);

  return {
    title: titleMatch?.[1]?.trim() || "",
    description: descriptionMatch?.[1]?.trim() || "",
    textSnippet: textOnly
  };
}

function extractKeywords(text) {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);

  const counts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

async function tryFetchWebsite(url) {
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
      }
    });
    return {
      success: true,
      finalUrl: response.request?.res?.responseUrl || url,
      ...extractSiteSummary(response.data || "")
    };
  } catch (_err) {
    return { success: false };
  }
}

async function resolveCompany(companyName, input) {
  const domainSeed = slugifyCompany(companyName) || "company";
  const candidates = [`https://${domainSeed}.com`, `https://www.${domainSeed}.com`];
  let website = candidates[0];
  let websiteData = { success: false, title: "", description: "", textSnippet: "" };

  for (const candidate of candidates) {
    const data = await tryFetchWebsite(candidate);
    if (data.success) {
      website = data.finalUrl || candidate;
      websiteData = data;
      break;
    }
  }

  return {
    name: companyName,
    website,
    industry: input.industry || "Unknown",
    companySize: input.companySize || "Unknown",
    geography: input.geography || "Unknown",
    websiteSummary: {
      title: websiteData.title,
      description: websiteData.description,
      textSnippet: websiteData.textSnippet,
      keywords: extractKeywords(
        [websiteData.title, websiteData.description, websiteData.textSnippet].join(" ")
      ),
      liveFetched: websiteData.success
    },
    source: websiteData.success ? "live-website-fetch" : "POC-heuristic"
  };
}

module.exports = {
  resolveCompany
};
