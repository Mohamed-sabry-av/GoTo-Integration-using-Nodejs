const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

// GoTo API Credentials
const GOTO_CLIENT_ID = process.env.GOTO_CLIENT_ID;
const GOTO_CLIENT_SECRET = process.env.GOTO_CLIENT_SECRET;
const GOTO_AUTH_URL = process.env.GOTO_AUTH_URL;
const GOTO_API_BASE = process.env.GOTO_API_BASE;
const CALL_LOGS_ENDPOINT = `${GOTO_API_BASE}/call-events-report/v1/report-summaries`;

// Account Key (required by GoTo API)
const accountKey = "7098445314927025895"; 

// Redirect URI for authentication
const REDIRECT_URI = "https://example.com";

// Token storage
let accessToken = null;
let refreshToken = null;
let tokenExpiration = 0;

/**
 * Returns the current token state.
 */
const getTokenState = () => ({
  accessToken,
  refreshToken,
  tokenExpiration
});

/**
 * Fetches an access token using an authorization code.
 */
const getAccessTokenFromAuthCode = async (authCode) => {
  try {
    const basicAuth = Buffer.from(`${GOTO_CLIENT_ID}:${GOTO_CLIENT_SECRET}`).toString("base64");

    const data = new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: REDIRECT_URI,
      scope: "call-events.v1.events.read cr.v1.read",
    });

    const response = await axios.post(GOTO_AUTH_URL, data.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Store the access token and refresh token
    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token || refreshToken;
    tokenExpiration = Date.now() + response.data.expires_in * 1000;

    console.log(`New access token valid until: ${new Date(tokenExpiration).toISOString()}`);
    return accessToken;
  } catch (error) {
    console.error("GoTo Authentication Failed:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with GoTo API using authorization code");
  }
};

/**
 * Refreshes the access token using the refresh token.
 */
const refreshGoToAccessToken = async () => {
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    const basicAuth = Buffer.from(`${GOTO_CLIENT_ID}:${GOTO_CLIENT_SECRET}`).toString("base64");

    const data = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const response = await axios.post(GOTO_AUTH_URL, data.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Store the new access token and refresh token
    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token || refreshToken;
    tokenExpiration = Date.now() + response.data.expires_in * 1000;

    console.log(`Refreshed access token valid until: ${new Date(tokenExpiration).toISOString()}`);
    return accessToken;
  } catch (error) {
    console.error("GoTo Token Refresh Failed:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Retrieves the access token (either from auth code or refresh token).
 */
const getGoToAccessToken = async (authCode) => {
  if (authCode) {
    return getAccessTokenFromAuthCode(authCode);
  } else {
    throw new Error("Authorization code is required to obtain an access token.");
  }
};

/**
 * Fetches call logs from the GoTo API.
 */
const fetchCallLogs = async (fromDate, toDate) => {
  try {
    console.log("Fetching Call Logs...");

    // Ensure a valid access token
    if (!accessToken || Date.now() >= tokenExpiration) {
      console.log("Access token expired, refreshing...");
      await refreshGoToAccessToken();
    }

    const params = {
      accountKey: accountKey,
      startTime: fromDate.toISOString(),
      endTime: toDate.toISOString(),
      pageSize: 200,
    };

    let allLogs = [];
    let nextPageMarker = null;

    do {
      if (nextPageMarker) {
        params.pageMarker = nextPageMarker;
      } else {
        delete params.pageMarker;
      }

      console.log("Fetching logs with params:", params);

      const response = await axios.get(CALL_LOGS_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      });

      allLogs = allLogs.concat(response.data.items);
      nextPageMarker = response.data.nextPageMarker;
    } while (nextPageMarker);

    return allLogs.map((log) => ({
      dateTime: log.startTime,
      callerName: log.caller?.name || "Unknown",
      callerNumber: log.caller?.number || "Private",
      callType: log.direction === "inbound" ? "Inbound" : "Outbound",
    }));
  } catch (error) {
    console.error("GoTo API Error:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Ensures the access token is valid.
 */
const ensureValidToken = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    console.log("Access token expired. Refreshing...");
    await refreshGoToAccessToken();
  }
};

module.exports = {
  GOTO_CLIENT_ID,
  REDIRECT_URI,
  getGoToAccessToken,
  refreshGoToAccessToken,
  getAccessTokenFromAuthCode,
  fetchCallLogs,
  getTokenState,
};
