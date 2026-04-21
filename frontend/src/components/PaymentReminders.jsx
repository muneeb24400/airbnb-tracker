/**
 * PaymentReminders.jsx
 * Shows all bookings with outstanding remaining payments.
 * Sorted by check-out date (most overdue first).
 * Includes WhatsApp reminder message generator.
 */
import React, { useState, useMemo } from "react";

const fmt = (n, currency = "PKR", rate = 278) => {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0,
    }).format((n || 0) / rate);
  }
  return new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 0,
  }).format(n || 0);
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-PK", {
    day: "numeric", month: "short", year: "numeric",
  }) : "—";

// Days until / since check-out
function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function urgencyConfig(days) {
  if (days === null) return { color: "#9994a8", label: "", bg: "transparent" };
  if (days < 0)  return { color: "#ff6b6b", label: `${Math.abs(days)}d overdue`, bg: "rgba(255,107,107,0.12)" };
  if (days === 0) return { color: "#f97316", label: "Check-out today",           bg: "rgba(249,115,22,0.12)" };
  if (days <= 3)  return { color: "#f97316", label: `${days}d left`,             bg: "rgba(249,115,22,0.08)" };
  return           { color: "#4ecdc4", label: `${days}d left`,                   bg: "rgba(78,205,196,0.06)" };
}

// ─── Format phone number to WhatsApp-compatible international format ──────────
// wa.me requires: country code + number, no spaces/dashes, no leading 0
// Examples:
//   0388888888   → 92388888888   (PK local with leading 0)
//   +923001234567 → 923001234567  (already international)
//   923001234567  → 923001234567  (already correct)
function formatPhoneForWA(phone) {
  if (!phone) return null;
  // Strip everything except digits
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // If starts with 0 → replace with 92 (Pakistan country code)
  if (digits.startsWith("0")) {
    digits = "92" + digits.slice(1);
  }
  // If doesn't start with a country code (less than 11 digits), add 92
  if (digits.length <= 10) {
    digits = "92" + digits;
  }
  return digits;
}

// Generate WhatsApp reminder message
function generateWAMessage(booking) {
  return encodeURIComponent(
    `Assalam o Alaikum ${booking.guestName}! 🏠\n\n` +
    `This is a friendly reminder regarding your booking at *${booking.property}*.\n\n` +
    `📅 Check-out: *${fmtDate(booking.checkOut)}*\n` +
    `💰 Remaining Payment: *PKR ${Number(booking.remaining).toLocaleString()}*\n\n` +
    `Please ensure payment is cleared by check-out. Thank you! 🙏\n\n` +
    `— StayTrack Booking System`
  );
}

export default function PaymentReminders({ bookings, currency, rate }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Only show bookings with remaining > 0, excluding cancelled
  const pending = useMemo(() => {
    return bookings
      .filter((b) => (b.remaining || 0) > 0 && b.status !== "Cancelled")
      .filter((b) => {
        const q = search.toLowerCase();
        return !q || b.guestName?.toLowerCase().includes(q) || b.property?.toLowerCase().includes(q);
      })
      .filter((b) => {
        if (filter === "All") return true;
        const days = daysFromToday(b.checkOut);
        if (filter === "Overdue")  return days !== null && days < 0;
        if (filter === "Today")    return days === 0;
        if (filter === "This Week") return days !== null && days >= 0 && days <= 7;
        return true;
      })
      .sort((a, b) => new Date(a.checkOut) - new Date(b.checkOut));
  }, [bookings, search, filter]);

  // Total outstanding
  const totalPending = pending.reduce((s, b) => s + (b.remaining || 0), 0);
  const overdueCount = pending.filter((b) => daysFromToday(b.checkOut) < 0).length;

  return (
    <div>
      {/* Summary banner */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16, marginBottom: 24,
      }}>
        {[
          { icon: "⏳", label: "Total Pending",   value: fmt(totalPending, currency, rate), color: "rgba(255,107,107,0.12)" },
          { icon: "🚨", label: "Overdue",          value: overdueCount,                      color: "rgba(249,115,22,0.12)"  },
          { icon: "📋", label: "Open Reminders",   value: pending.length,                    color: "rgba(212,168,83,0.12)"  },
          { icon: "✅", label: "Fully Paid",        value: bookings.filter((b) => (b.remaining || 0) <= 0 && b.status !== "Cancelled").length, color: "rgba(81,207,102,0.12)" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "16px 20px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase",
                letterSpacing: "0.06em", fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 18, fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="🔍 Search guest or property…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-primary)", fontSize: 13,
            padding: "8px 14px", outline: "none", fontFamily: "var(--font-body)", width: 220 }}
        />
        {["All", "Overdue", "Today", "This Week"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="btn" style={{
            padding: "7px 14px", fontSize: 12,
            background: filter === f ? "var(--accent-gold-dim)" : "transparent",
            border: filter === f ? "1px solid var(--border-accent)" : "1px solid var(--border)",
            color: filter === f ? "var(--accent-gold)" : "var(--text-secondary)",
            fontWeight: filter === f ? 600 : 400,
          }}>{f}</button>
        ))}
      </div>

      {/* Reminders list */}
      {pending.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ marginBottom: 8 }}>All payments cleared!</h3>
          <p style={{ fontSize: 14 }}>No outstanding balances found.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pending.map((b) => {
            const days    = daysFromToday(b.checkOut);
            const urgency = urgencyConfig(days);
            const waPhone = formatPhoneForWA(b.phone);
            const waLink  = waPhone
              ? `https://wa.me/${waPhone}?text=${generateWAMessage(b)}`
              : null;

            return (
              <div key={b.bookingId} className="card" style={{
                padding: "18px 22px", background: urgency.bg,
                borderColor: `${urgency.color}30`,
                display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
              }}>
                {/* Guest info */}
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{b.guestName}</span>
                    {urgency.label && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px",
                        borderRadius: 99, background: `${urgency.color}20`,
                        color: urgency.color, letterSpacing: "0.04em", textTransform: "uppercase",
                      }}>{urgency.label}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    🏠 {b.property} · 📱 {b.phone || "No phone"} · {b.bookingId}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Check-out: {fmtDate(b.checkOut)}
                  </p>
                </div>

                {/* Payment details */}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase",
                      letterSpacing: "0.06em", fontWeight: 500, marginBottom: 2 }}>Total</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-gold)" }}>
                      {fmt(b.totalPrice, currency, rate)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase",
                      letterSpacing: "0.06em", fontWeight: 500, marginBottom: 2 }}>Paid</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-green)" }}>
                      {fmt(b.advancePaid, currency, rate)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase",
                      letterSpacing: "0.06em", fontWeight: 500, marginBottom: 2 }}>Due</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: urgency.color }}>
                      {fmt(b.remaining, currency, rate)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {waLink ? (
                    <a href={waLink} target="_blank" rel="noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(37,211,102,0.15)",
                        border: "1px solid rgba(37,211,102,0.3)",
                        color: "#25d366", borderRadius: 8,
                        padding: "7px 12px", fontSize: 12, fontWeight: 600,
                        textDecoration: "none", cursor: "pointer",
                      }}>
                      💬 WhatsApp
                    </a>
                  ) : (
                    <div title="No valid phone number saved for this guest"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(90,88,112,0.2)",
                        border: "1px solid rgba(90,88,112,0.2)",
                        color: "var(--text-muted)", borderRadius: 8,
                        padding: "7px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "not-allowed", opacity: 0.5,
                      }}>
                      💬 No Phone
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
