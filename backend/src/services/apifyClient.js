const axios = require("axios");

function hasApifyToken() {
  return Boolean(process.env.APIFY_TOKEN);
}

function assertServerSide() {
  if (typeof window !== "undefined") {
    throw new Error("Apify connectors must be called from the server side.");
  }
}

function buildAuthQuery() {
  return `token=${encodeURIComponent(process.env.APIFY_TOKEN || "")}`;
}

function extractRunData(responseData) {
  return responseData?.data || responseData?.run || responseData || {};
}

async function runApifyActor({ actorId, input, timeoutSeconds = 120 }) {
  assertServerSide();

  if (!hasApifyToken() || !actorId) {
    return {
      ok: false,
      status: 503,
      error: "APIFY_TOKEN or actorId not configured"
    };
  }

  try {
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs?${buildAuthQuery()}&waitForFinish=${timeoutSeconds}`,
      input,
      {
        timeout: (timeoutSeconds + 30) * 1000,
        headers: { "Content-Type": "application/json" }
      }
    );

    const runData = extractRunData(runResponse.data);
    const datasetId = runData.defaultDatasetId;

    if (!datasetId) {
      return {
        ok: true,
        run: runData,
        items: [],
        source: "apify"
      };
    }

    const datasetResponse = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items?${buildAuthQuery()}&clean=true`,
      {
        timeout: timeoutSeconds * 1000,
        headers: { "Content-Type": "application/json" }
      }
    );

    return {
      ok: true,
      run: runData,
      items: Array.isArray(datasetResponse.data)
        ? datasetResponse.data
        : datasetResponse.data?.items || [],
      source: "apify"
    };
  } catch (error) {
    return {
      ok: false,
      status: error?.response?.status || 500,
      error: error?.response?.data || error?.message || "Apify actor run failed"
    };
  }
}

module.exports = {
  hasApifyToken,
  runApifyActor
};
