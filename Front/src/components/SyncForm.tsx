import { useState } from "react";
import { syncNow, updateSyncInterval } from "../services/api";
import "./SyncForm.css"; // استيراد ملف CSS الخاص بالمكون

const SyncForm = () => {
  const [googleSheetId, setGoogleSheetId] = useState(""); // حالة لمعرف Google Sheet
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [interval, setIntervalValue] = useState<number>(5); // الافتراضي 5 دقائق
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // دالة تنفيذ المزامنة اليدوية
  const handleSyncNow = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const data = await syncNow(googleSheetId, startDate, endDate);
      setMessage(data);
    } catch (err: any) {
      console.error("Sync failed", err);
      setError("Failed to sync data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // دالة تحديث زمن المزامنة التلقائية
  const handleUpdateInterval = async () => {
    setMessage(null);
    setError(null);

    try {
      const data = await updateSyncInterval(interval);
      setMessage(data);
    } catch (err: any) {
      console.error("Failed to update sync interval", err);
      setError("Failed to update sync interval. Please try again.");
    }
  };

  return (
    <div className="sync-form-container">
      <h2>Sync Settings</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        {/* حقل إدخال معرف Google Sheet */}
        <div>
          <label>
            Google Sheet ID:
            <input
              type="text"
              value={googleSheetId}
              onChange={(e) => setGoogleSheetId(e.target.value)}
              required
            />
          </label>
        </div>

        {/* اختيار التواريخ */}
        <div>
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <label>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <button type="button" onClick={handleSyncNow} disabled={loading}>
            {loading ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {/* تحديد مدة التزامن التلقائي */}
        <div>
          <label>
            Sync Interval (minutes):
            <input
              type="number"
              value={interval}
              onChange={(e) => setIntervalValue(Number(e.target.value))}
              min={1}
            />
          </label>
        </div>
        <div>
          <button type="button" onClick={handleUpdateInterval}>
            Update Interval
          </button>
        </div>

        {/* عرض رسالة نجاح أو خطأ */}
        {message && (
          <p className="message success">{message}</p>
        )}
        {error && (
          <p className="message error">{error}</p>
        )}
      </form>
    </div>
  );
};

export default SyncForm;
