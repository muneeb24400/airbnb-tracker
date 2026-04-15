/**
 * StatsCards.jsx
 * Shows 4 summary tiles: Total Revenue, Advance Collected, Pending, and Total Bookings
 */
import React from "react";

// ─── Individual stat tile ─────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div
      className="card"
      style={{
        padding: "22px 24px",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        transition: "transform 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "12px",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)" }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Stats grid ───────────────────────────────────────────────────────────────
export default function StatsCards({ bookings }) {
  // Calculate totals from all bookings
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const totalAdvance = bookings.reduce((sum, b) => sum + (b.advancePaid || 0), 0);
  const totalPending = bookings.reduce((sum, b) => sum + (b.remaining || 0), 0);

  // Count upcoming check-ins within 3 days
  const today = new Date();
  const upcomingSoon = bookings.filter((b) => {
    const checkIn = new Date(b.checkIn);
    const diff = (checkIn - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3 && b.status !== "Completed";
  }).length;

  const fmt = (n) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n);

  const stats = [
    {
      label: "Total Revenue",
      value: fmt(totalRevenue),
      icon: "💰",
      color: "rgba(212, 168, 83, 0.15)",
      sub: `${bookings.length} total bookings`,
    },
    {
      label: "Advance Collected",
      value: fmt(totalAdvance),
      icon: "✅",
      color: "rgba(81, 207, 102, 0.12)",
      sub: `${Math.round((totalAdvance / (totalRevenue || 1)) * 100)}% of total`,
    },
    {
      label: "Pending Payment",
      value: fmt(totalPending),
      icon: "⏳",
      color: "rgba(255, 107, 107, 0.12)",
      sub: totalPending > 0 ? "To be collected" : "All cleared!",
    },
    {
      label: "Upcoming Check-ins",
      value: upcomingSoon,
      icon: "🏠",
      color: "rgba(78, 205, 196, 0.15)",
      sub: "Within next 3 days",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "28px",
      }}
    >
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}
