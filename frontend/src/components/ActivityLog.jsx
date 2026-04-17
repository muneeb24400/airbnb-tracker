/**
 * ActivityLog.jsx
 * Displays a full audit trail of all actions taken in the app.
 * Fetched from the ActivityLog tab in Google Sheets.
 */
import React, { useState, useEffect } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";

// ─── Action display config ────────────────────────────────────────────────────
const ACTION_CONFIG = {
  BOOKING_ADDED:     { icon: "➕", label: "Booking Added",     color: "#51cf66" },
  BOOKING_EDITED:    { icon: "✏️",  label: "Booking Edited",    color: "#4ecdc4" },
  BOOKING_DELETED:   { icon: "🗑️", label: "Booking Deleted",   color: "#ff6b6b" },
  BOOKING_CANCELLED: { icon: "❌",  label: "Booking Cancelled", color: "#f97316" },
  STATUS_CHANGED:    { icon: "🔄",  label: "Status Changed",    color: "#a78bfa" },
};

function timeAgo(isoString) {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("All");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${BASE_URL}/api/activity`);
        const data = await res.json();
        setActivities(data.activities || []);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const ACTION_TYPES = ["All", ...Object.keys(ACTION_CONFIG)];

  const filtered = filter === "All"
    ? activities
    : activities.filter((a) => a.action === filter);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Filter:</span>
        {ACTION_TYPES.map((type) => {
          const cfg = ACTION_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className="btn"
              style={{
                padding: "5px 12px", fontSize: 12,
                background: filter === type
                  ? (cfg ? `${cfg.color}20` : "var(--accent-gold-dim)")
                  : "transparent",
                border: filter === type
                  ? `1px solid ${cfg?.color || "var(--accent-gold)"}50`
                  : "1px solid var(--border)",
                color: filter === type
                  ? (cfg?.color || "var(--accent-gold)")
                  : "var(--text-secondary)",
              }}
            >
              {cfg ? `${cfg.icon} ${cfg.label}` : "All"}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 12 }}>
          {filtered.length} entries
        </span>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
          <p>No activity logged yet.</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            Actions like adding, editing, and deleting bookings will appear here.
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {filtered.map((a, i) => {
            const cfg = ACTION_CONFIG[a.action] || { icon: "📝", label: a.action, color: "#9994a8" };
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "16px 20px",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-card-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${cfg.color}18`,
                  border: `1px solid ${cfg.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      {a.bookingId && (
                        <span style={{
                          marginLeft: 8, fontSize: 11, color: "var(--text-muted)",
                          background: "var(--bg-secondary)", borderRadius: 4,
                          padding: "1px 6px",
                        }}>
                          {a.bookingId}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }} title={formatDate(a.timestamp)}>
                        🕐 {timeAgo(a.timestamp)}
                      </span>
                    </div>
                  </div>

                  {a.guestName && (
                    <p style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>
                      👤 {a.guestName}
                    </p>
                  )}
                  {a.details && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {a.details}
                    </p>
                  )}
                </div>

                {/* Timestamp on hover */}
                <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, textAlign: "right" }}>
                  {formatDate(a.timestamp)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
