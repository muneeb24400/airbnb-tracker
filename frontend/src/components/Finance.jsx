/**
 * Finance.jsx
 * Main finance page with sub-tabs:
 * - Payment Reminders
 * - Expense Tracker
 * - Currency / Exchange Rate
 */
import React, { useState, useEffect } from "react";
import PaymentReminders from "./PaymentReminders";
import ExpenseTracker   from "./ExpenseTracker";

const BASE_URL = process.env.REACT_APP_API_URL || "";
import { bizFetch, bizUrl } from "../utils/bizApi";

export default function Finance({ bookings, properties }) {
  const [subTab,    setSubTab]    = useState("reminders");
  const [currency,  setCurrency]  = useState("PKR");
  const [rate,      setRate]      = useState(278);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateTime,  setRateTime]  = useState(null);

  // ── Fetch exchange rate on mount ────────────────────────────────────────────
  useEffect(() => {
    const fetchRate = async () => {
      setRateLoading(true);
      try {
        const res  = await bizFetch(`/api/currency`);
        const data = await res.json();
        if (data.success && data.rate) {
          setRate(data.rate);
          setRateTime(new Date());
        }
      } catch { /* use default rate */ }
      finally { setRateLoading(false); }
    };
    fetchRate();
  }, []);

  const SUBTABS = [
    { key: "reminders", label: "💸 Payment Reminders" },
    { key: "expenses",  label: "📊 Expense Tracker" },
  ];

  return (
    <div>
      {/* Sub-nav + currency toggle */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {SUBTABS.map((t) => (
            <button key={t.key} onClick={() => setSubTab(t.key)} className="btn" style={{
              padding: "8px 18px", fontSize: 13,
              background: subTab === t.key ? "var(--accent-gold-dim)" : "transparent",
              border: subTab === t.key ? "1px solid var(--border-accent)" : "1px solid var(--border)",
              color: subTab === t.key ? "var(--accent-gold)" : "var(--text-secondary)",
              fontWeight: subTab === t.key ? 600 : 400,
            }}>{t.label}</button>
          ))}
        </div>

        {/* Currency toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {rateTime && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              1 USD = PKR {Math.round(rate)} · {rateLoading ? "updating…" : "live"}
            </span>
          )}
          <div style={{ display: "flex", background: "var(--bg-secondary)",
            border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {["PKR", "USD"].map((c) => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: "7px 16px", fontSize: 12, fontWeight: 600,
                background: currency === c ? "var(--accent-gold)" : "transparent",
                border: "none", color: currency === c ? "#0f0f1a" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.15s",
                fontFamily: "var(--font-body)",
              }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-tab content */}
      {subTab === "reminders" && (
        <PaymentReminders bookings={bookings} currency={currency} rate={rate} />
      )}
      {subTab === "expenses" && (
        <ExpenseTracker properties={properties} currency={currency} rate={rate} />
      )}
    </div>
  );
}
