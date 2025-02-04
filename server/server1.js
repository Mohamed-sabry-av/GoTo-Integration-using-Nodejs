const express = require("express");
const { google } = require("googleapis");
const cron = require("node-cron");
const cors = require("cors");
const dotenv = require("dotenv");

const {
  fetchCallLogs,
  getTokenState,
  refreshGoToAccessToken,
  GOTO_CLIENT_ID,
  REDIRECT_URI,
  getAccessTokenFromAuthCode,
} = require("./GotoAuth");

dotenv.config();

const app = express();
app.use(cors());

const SPREADSHEET_ID = "1UzC32yPdzV6N2TNh7qGYv1d1gPbhrFlkfqdGbFt5Dc4";
const SHEET_NAME = "Sheet1"; // Define the sheet name
const GOOGLE_CREDENTIALS = require("./credentials.json");

// Initialize Google Sheets API client
const getSheetsClient = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
};

// Update Google Sheet with new call logs (avoiding duplicates)
const updateSheet = async (logs) => {
  try {
    const sheets = await getSheetsClient();

    // Fetch existing data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
    });

    const existingData = response.data.values || [];
    const existingKeys = new Set(existingData.map((row) => `${row[0]}_${row[2]}`));

    // Filter out duplicate entries
    const newEntries = logs.filter((log) => {
      const key = `${log.dateTime}_${log.callerNumber}`;
      return !existingKeys.has(key);
    });

    // Append new data if available
    if (newEntries.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:D`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: newEntries.map((entry) => [
            entry.dateTime,
            entry.callerName,
            entry.callerNumber,
            entry.callType,
          ]),
        },
      });
      console.log(`Added ${newEntries.length} new records`);
    }
  } catch (error) {
    console.error("Google Sheets Error:", error.message);
    throw error;
  }
};

// Ensure access token is valid, refresh if expired
const ensureValidToken = async () => {
  const { accessToken, tokenExpiration } = getTokenState();
  if (!accessToken || Date.now() >= tokenExpiration) {
    console.log("Access token expired. Refreshing...");
    await refreshGoToAccessToken();
  }
};

// Schedule automatic synchronization every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("Starting scheduled sync...");
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 5 * 60 * 1000); // Last 5 minutes

    const logs = await fetchCallLogs(startDate, endDate);
    await updateSheet(logs);
    await ensureValidToken();

    console.log(`Sync completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error("Scheduled Sync Failed:", error);
  }
});

// API endpoint to manually trigger synchronization
app.get("/sync-now", async (req, res) => {
  try {
    const logs = await fetchCallLogs(new Date(Date.now() - 86400000), new Date()); // Last 24 hours
    await updateSheet(logs);
    res.send("Manual sync completed successfully");
  } catch (error) {
    res.status(500).send("Manual sync failed: " + error.message);
  }
});

// Redirect user to GoTo authentication page
app.get("/goto/auth", (req, res) => {
  const authUrl = `https://authentication.logmeininc.com/oauth/authorize?response_type=code&client_id=${GOTO_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(authUrl);
});

// Handle OAuth callback and exchange authorization code for an access token
app.get("/goto/callback", async (req, res) => {
  const authCode = req.query.code;
  if (!authCode) {
    return res.status(400).send("Authorization code is missing");
  }

  try {
    const token = await getAccessTokenFromAuthCode(authCode);
    res.send(`Access Token: ${token}`);
  } catch (error) {
    res.status(500).send("Error getting access token");
  }
});

// Start the server
app.listen(1337, () => console.log("Server running on port 1337"));