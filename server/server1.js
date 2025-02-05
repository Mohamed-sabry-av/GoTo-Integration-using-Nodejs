const express = require("express");
const { google } = require("googleapis");
const cron = require("node-cron");
const cors = require("cors");
const dotenv = require("dotenv");
const qs = require("querystring"); // للتعامل مع data URL-encoded
const axios = require("axios");
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
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// الإعدادات الخاصة بـ Google Sheets
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";
const GOOGLE_CREDENTIALS = require("./credentials.json");

// دالة تهيئة عميل Google Sheets API
const getSheetsClient = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
};

// دالة تحديث Google Sheet (مع تجنب التكرار)
const updateSheet = async (logs, spreadsheetId = SPREADSHEET_ID) => {
  try {
    const sheets = await getSheetsClient();

    // جلب البيانات الحالية من الشيت
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
    });

    const existingData = response.data.values || [];
    const existingKeys = new Set(existingData.map((row) => `${row[0]}_${row[2]}`));

    // تصفية السجلات المكررة
    const newEntries = logs.filter((log) => {
      const key = `${log.dateTime}_${log.callerNumber}`;
      return !existingKeys.has(key);
    });

    // إضافة السجلات الجديدة
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

// التأكد من صلاحية الـ access token
const ensureValidToken = async () => {
  const { accessToken, tokenExpiration } = getTokenState();
  if (!accessToken || Date.now() >= tokenExpiration) {
    console.log("Access token expired. Refreshing...");
    await refreshGoToAccessToken();
  }
};

// إعداد الـ Cron Job كما هو لديك
let syncInterval = process.env.SYNC_INTERVAL || 5;
let scheduledTask = cron.schedule(
  `*/${syncInterval} * * * *`,
  async () => {
    try {
      console.log("Starting scheduled sync...");
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - syncInterval * 60 * 1000);

      const logs = await fetchCallLogs(startDate, endDate);
      await updateSheet(logs);
      await ensureValidToken();

      console.log(`Sync completed at ${new Date().toISOString()}`);
    } catch (error) {
      console.error("Scheduled Sync Failed:", error);
    }
  },
  { scheduled: true }
);

// API endpoint لتحديث زمن المزامنة
app.post("/update-sync-interval", (req, res) => {
  const { interval } = req.body;

  if (!interval || isNaN(interval) || interval <= 0) {
    return res.status(400).send("Invalid interval value.");
  }

  syncInterval = interval;
  console.log(`Sync interval updated to ${syncInterval} minutes.`);

  scheduledTask.stop();
  scheduledTask = cron.schedule(
    `*/${syncInterval} * * * *`,
    async () => {
      try {
        console.log("Starting scheduled sync...");
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - syncInterval * 60 * 1000);

        const logs = await fetchCallLogs(startDate, endDate);
        await updateSheet(logs);
        await ensureValidToken();

        console.log(`Sync completed at ${new Date().toISOString()}`);
      } catch (error) {
        console.error("Scheduled Sync Failed:", error);
      }
    },
    { scheduled: true }
  );
  scheduledTask.start();

  res.send(`Sync interval updated to ${syncInterval} minutes.`);
});

// API endpoint للمزامنة اليدوية
app.post("/sync-now", async (req, res) => {
  try {
    const { spreadsheetId, startDate, endDate } = req.body;
    console.log(req.body);

    const logs = await fetchCallLogs(new Date(startDate), new Date(endDate));
    await updateSheet(logs, spreadsheetId);
    res.send("Manual sync completed successfully");
  } catch (error) {
    res.status(500).send("Manual sync failed: " + error.message);
  }
});

/* ***********************
   OAuth Flow Endpoints
   *********************** */

// إعادة توجيه المستخدم إلى صفحة تسجيل الدخول الخاصة بـ GoTo
app.get("/goto/auth", (req, res) => {
  const authUrl = `https://authentication.logmeininc.com/oauth/authorize?response_type=code&client_id=${GOTO_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(authUrl);
});

// معالجة الـ callback وتبديل الكود بـ access token
app.get("/goto/callback", async (req, res) => {
  const authCode = req.query.code;
  if (!authCode) {
    return res.status(400).send("Authorization code is missing");
  }
  try {
    const token = await getAccessTokenFromAuthCode(authCode);
    // هنا يمكنك حفظ التوكن في الجلسة أو قاعدة البيانات إذا أردت.
    // بعد الحصول على التوكن، نعرض صفحة تأكيد تُرسل رسالة للنافذة الأصلية وتغلق النافذة.
    res.send(` http://localhost:5173?access_token=${token}`);
  } catch (error) {
    res.status(500).send("Error getting access token: " + error.message);
  }
});



const PORT = process.env.PORT || 1337;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
