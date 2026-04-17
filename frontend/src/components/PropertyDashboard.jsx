/**
 * PropertyDashboard.jsx
 * Full per-property dashboard showing:
 * - Property photo + info header
 * - Revenue, occupancy, pending payments stats
 * - Monthly revenue mini chart
 * - All bookings for this property (filterable)
 */
import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getLastSixMonths() {
  const result = [];
  const now    = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ label: MONTHS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ─── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: "var(--bg-secondary)", borderRadius: 12,
      padding: "16px 18px", border: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: color,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <p style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase",
          letterSpacing: "0.06em", fontWeight: 500 }}>{label}</p>
      </div>
      <p style={{ fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 600 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  Upcoming:  { bg: "rgba(78,205,196,0.15)",  color: "#4ecdc4" },
  Active:    { bg: "rgba(81,207,102,0.12)",  color: "#51cf66" },
  Completed: { bg: "rgba(90,88,112,0.3)",    color: "#9994a8" },
  Cancelled: { bg: "rgba(255,107,107,0.15)", color: "#ff6b6b" },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function PropertyDashboard({ property, allBookings, onClose, onEdit }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [search,       setSearch]       = useState("");

  // ── Filter bookings for this property ──────────────────────────────────────
  const propBookings = useMemo(
    () => allBookings.filter((b) => b.property === property.name),
    [allBookings, property.name]
  );

  // ── Key stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = propBookings.reduce((s, b) => s + (b.totalPrice   || 0), 0);
    const advance  = propBookings.reduce((s, b) => s + (b.advancePaid  || 0), 0);
    const pending  = propBookings.reduce((s, b) => s + (b.remaining    || 0), 0);
    const nights   = propBookings.reduce((s, b) => s + (parseInt(b.nights) || 0), 0);

    const today    = new Date();
    const upcoming = propBookings.filter((b) => {
      const ci   = new Date(b.checkIn);
      const diff = (ci - today) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7 && b.status === "Upcoming";
    }).length;

    // This month occupancy
    const year  = today.getFullYear();
    const month = today.getMonth();
    const days  = daysInMonth(year, month);
    let booked  = 0;
    propBookings
      .filter((b) => b.status !== "Cancelled")
      .forEach((b) => {
        const mStart = new Date(year, month, 1);
        const mEnd   = new Date(year, month + 1, 0);
        const ci     = new Date(b.checkIn);
        const co     = new Date(b.checkOut);
        const oStart = ci < mStart ? mStart : ci;
        const oEnd   = co > mEnd   ? mEnd   : co;
        if (oEnd > oStart) booked += Math.ceil((oEnd - oStart) / (1000 * 60 * 60 * 24));
      });
    const occupancy = Math.min(100, Math.round((booked / days) * 100));

    return { total, advance, pending, nights, upcoming, occupancy };
  }, [propBookings]);

  // ── Monthly revenue chart ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return getLastSixMonths().map(({ label, year, month }) => ({
      month: label,
      Revenue: propBookings
        .filter((b) => {
          const d = new Date(b.checkIn);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((s, b) => s + (b.totalPrice || 0), 0),
    }));
  }, [propBookings]);

  // ── Filtered bookings list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return propBookings
      .filter((b) => {
        const q = search.toLowerCase();
        const matchSearch = !q || b.guestName?.toLowerCase().includes(q) || b.phone?.includes(q);
        const matchStatus = statusFilter === "All" || b.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
  }, [propBookings, search, statusFilter]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        zIndex: 200, backdropFilter: "blur(4px)",
      }} />

      {/* Panel — slides in from right */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(780px, 100vw)",
        background: "var(--bg-primary)",
        borderLeft: "1px solid var(--border)",
        zIndex: 201, overflowY: "auto",
        animation: "slideInRight 0.3s ease",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
      }}>

        {/* ── Hero header ── */}
        <div style={{
          height: 200, background: "var(--bg-secondary)",
          backgroundImage: property.photoUrl ? `url(${property.photoUrl})` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          position: "relative", display: "flex", alignItems: "flex-end",
        }}>
          {/* Gradient overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(15,15,26,0.95) 0%, rgba(15,15,26,0.3) 60%, transparent 100%)",
          }} />
          {/* Close & Edit buttons */}
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => onEdit(property)}
              style={{ padding: "6px 14px", fontSize: 13, background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
              ✏️ Edit
            </button>
            <button onClick={onClose} style={{ background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", borderRadius: 8, padding: "6px 12px",
              cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          {/* Property name */}
          <div style={{ position: "relative", padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                padding: "2px 8px", borderRadius: 99, textTransform: "uppercase",
                background: property.noOverlap
                  ? "rgba(255,107,107,0.8)" : "rgba(81,207,102,0.8)",
                color: "#fff",
              }}>
                {property.noOverlap ? "🔒 No Overlap" : "✅ Overlap OK"}
              </span>
            </div>
            <h2 style={{ fontSize: 26, fontFamily: "var(--font-display)" }}>
              {property.name}
            </h2>
            {property.description && (
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 }}>
                {property.description}
              </p>
            )}
          </div>
        </div>

        <div style={{ padding: "24px" }}>

          {/* ── Stats grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatTile icon="💰" label="Total Revenue"    value={fmt(stats.total)}
              sub={`${propBookings.length} bookings`} color="rgba(212,168,83,0.15)" />
            <StatTile icon="⏳" label="Pending Payment"  value={fmt(stats.pending)}
              sub={stats.pending > 0 ? "To collect" : "All paid ✓"} color="rgba(255,107,107,0.12)" />
            <StatTile icon="📅" label="This Month"       value={`${stats.occupancy}%`}
              sub="Occupancy rate" color="rgba(78,205,196,0.15)" />
            <StatTile icon="🌙" label="Total Nights"     value={stats.nights}
              sub="Nights booked" color="rgba(167,139,250,0.15)" />
            <StatTile icon="✅" label="Advance Collected" value={fmt(stats.advance)}
              color="rgba(81,207,102,0.12)" />
            <StatTile icon="🔔" label="Upcoming (7d)"    value={stats.upcoming}
              sub="Check-ins this week" color="rgba(249,115,22,0.15)" />
          </div>

          {/* ── Revenue chart ── */}
          <div className="card" style={{ padding: "18px 20px", marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16 }}>📈 Monthly Revenue (last 6 months)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "#9994a8", fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                  tick={{ fill: "#9994a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1c1c32", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [fmt(v), "Revenue"]}
                />
                <Bar dataKey="Revenue" fill="#d4a853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Bookings list ── */}
          <div className="card" style={{ overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
              display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, flex: "1 1 auto" }}>All Bookings</h3>
              <input
                placeholder="🔍 Search guest…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--text-primary)", fontSize: 12,
                  padding: "6px 12px", width: 160, outline: "none",
                  fontFamily: "var(--font-body)" }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--text-primary)", fontSize: 12,
                  padding: "6px 10px", cursor: "pointer", fontFamily: "var(--font-body)" }}>
                {["All","Upcoming","Active","Completed","Cancelled"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                No bookings found
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                      {["Guest","Check-in","Check-out","Nights","Total","Remaining","Status"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left",
                          color: "var(--text-secondary)", fontWeight: 500,
                          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, i) => {
                      const s = STATUS_STYLE[b.status] || STATUS_STYLE.Upcoming;
                      return (
                        <tr key={b.bookingId || i}
                          style={{ borderBottom: "1px solid var(--border)" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-card-hover)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "11px 14px" }}>
                            <div style={{ fontWeight: 500 }}>{b.guestName}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{b.phone}</div>
                          </td>
                          <td style={{ padding: "11px 14px", color: "var(--text-secondary)" }}>{fmtDate(b.checkIn)}</td>
                          <td style={{ padding: "11px 14px", color: "var(--text-secondary)" }}>{fmtDate(b.checkOut)}</td>
                          <td style={{ padding: "11px 14px", color: "var(--text-muted)", textAlign: "center" }}>{b.nights}</td>
                          <td style={{ padding: "11px 14px", color: "var(--accent-gold)", fontWeight: 600 }}>{fmt(b.totalPrice)}</td>
                          <td style={{ padding: "11px 14px",
                            color: b.remaining > 0 ? "var(--accent-rose)" : "var(--text-muted)",
                            fontWeight: b.remaining > 0 ? 600 : 400 }}>
                            {fmt(b.remaining)}
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            <span style={{ background: s.bg, color: s.color,
                              borderRadius: 99, fontSize: 10, fontWeight: 700,
                              padding: "3px 8px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)",
              fontSize: 11, color: "var(--text-muted)" }}>
              {filtered.length} of {propBookings.length} bookings
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
