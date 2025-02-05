import axios from "axios";

/**
 * دالة تنفيذ المزامنة اليدوية.
 * @param googleSheetId معرف الـ Google Sheet.
 * @param startDate تاريخ البداية.
 * @param endDate تاريخ النهاية.
 * @returns بيانات الرد من الخادم.
 */
export const syncNow = async (
  googleSheetId: string,
  startDate: string,
  endDate: string
): Promise<string> => {
  const response = await axios.post(
    "http://localhost:1337/sync-now",
    { spreadsheetId: googleSheetId, startDate, endDate },
    { headers: { "Content-Type": "application/json" } }
  );
  return response.data;
};

/**
 * دالة تحديث زمن المزامنة التلقائية.
 * @param interval زمن التزامن بالدقائق.
 * @returns بيانات الرد من الخادم.
 */
export const updateSyncInterval = async (
  interval: number
): Promise<string> => {
  const response = await axios.post(
    "http://localhost:1337/update-sync-interval",
    { interval },
    { headers: { "Content-Type": "application/json" } }
  );
  return response.data;
};
