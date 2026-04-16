/**
 * Analytics.jsx
 * Full analytics dashboard with:
 * - Monthly Revenue Chart (stacked by property)
 * - Occupancy Rate Chart (% of days booked per month)
 * - Booking Source Pie Chart
 * - Per-property revenue breakdown
 * - Key insight cards
 *
 * Uses recharts (already available in React environments via CDN-like import)
 */
import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  Sector,
} from "recharts";

// ─── Colour palette for properties & sources ─────────────────────────────────
const PROPERTY_COLORS = {
  "Icon 613":                  "#d4a853",
  "Citysmart":                 "#4ecdc4",
  "Gulberg Outsource":         "#a78bfa",
  "Bahria Enclave Outsource":  "#f97316",
};

const SOURCE_COLORS = [
  "#d4a853", "#4ecdc4", "#a78bfa", "#f97316",
  "#51cf66", "#ff6b6b", "#74c0fc", "#f783ac",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmt = (n) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 0,
  }).format(n || 0);

const fmtShort = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n;
};

// Get last N months as { label, year, month } objects
function getLastNMonths(n = 6) {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() });
  }
  return result;
}

// Days in a given month
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Count booked days for a property in a given month
function bookedDays(bookings, property, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  let days = 0;
  bookings
    .filter((b) => b.property === property && b.status !== "Cancelled")
    .forEach((b) => {
      const ci = new Date(b.checkIn);
      const co = new Date(b.checkOut);
      const overlapStart = ci < monthStart ? monthStart : ci;
      const overlapEnd   = co > monthEnd   ? monthEnd   : co;
      if (overlapEnd > overlapStart) {
        days += Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
      }
    });
  return days;
}

// ─── Custom tooltip for bar/line charts ──────────────────────────────────────
function CustomTooltip({ active, payload, label, type = "currency" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1c1c32", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "12px 16px", fontSize: 13,
    }}>
      <p style={{ color: "#9994a8", marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.fill || p.color }} />
          <span style={{ color: "#f0eee8" }}>
            {p.name}: <strong>{type === "currency" ? fmt(p.value) : `${p.value}%`}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Active shape for pie chart ───────────────────────────────────────────────
function ActivePieShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#f0eee8" style={{ fontSize: 16, fontWeight: 700 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#9994a8" style={{ fontSize: 13 }}>
        {value} bookings ({(percent * 100).toFixed(1)}%)
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Section wrapper card ─────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, insight }) {
  return (
    <div className="card" style={{ padding: "24px 28px", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>{title}</h3>
          {subtitle && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{subtitle}</p>}
        </div>
        {insight && (
          <div style={{
            background: "var(--accent-gold-dim)", border: "1px solid var(--border-accent)",
            borderRadius: 10, padding: "8px 14px", fontSize: 13, color: "var(--accent-gold-light)",
            maxWidth: 280, textAlign: "right",
          }}>
            💡 {insight}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main Analytics Component ─────────────────────────────────────────────────
export default function Analytics({ bookings }) {
  const [pieIndex, setPieIndex]   = useState(0);
  const [monthRange, setMonthRange] = useState(6);

  const properties = Object.keys(PROPERTY_COLORS);
  const months     = getLastNMonths(monthRange);

  // ── 1. Monthly Revenue Data ─────────────────────────────────────────────────
  const revenueData = useMemo(() => {
    return months.map(({ label, year, month }) => {
      const row = { month: label };
      let total = 0;
      properties.forEach((prop) => {
        const amt = bookings
          .filter((b) => {
            const d = new Date(b.checkIn);
            return b.property === prop && d.getFullYear() === year && d.getMonth() === month;
          })
          .reduce((sum, b) => sum + (b.totalPrice || 0), 0);
        row[prop] = amt;
        total += amt;
      });
      row.total = total;
      return row;
    });
  }, [bookings, monthRange]);

  // ── 2. Occupancy Rate Data ──────────────────────────────────────────────────
  const occupancyData = useMemo(() => {
    return months.map(({ label, year, month }) => {
      const row = { month: label };
      const totalDays = daysInMonth(year, month);
      properties.forEach((prop) => {
        const booked = bookedDays(bookings, prop, year, month);
        row[prop] = Math.min(100, Math.round((booked / totalDays) * 100));
      });
      return row;
    });
  }, [bookings, monthRange]);

  // ── 3. Booking Source Data ──────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const counts = {};
    bookings.forEach((b) => {
      const src = b.source || "Other";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [bookings]);

  // ── 4. Per-Property Revenue Breakdown ──────────────────────────────────────
  const propertyBreakdown = useMemo(() => {
    return properties.map((prop) => {
      const propBookings = bookings.filter((b) => b.property === prop);
      const revenue  = propBookings.reduce((s, b) => s + (b.totalPrice  || 0), 0);
      const advance  = propBookings.reduce((s, b) => s + (b.advancePaid || 0), 0);
      const pending  = propBookings.reduce((s, b) => s + (b.remaining   || 0), 0);
      const nights   = propBookings.reduce((s, b) => s + (parseInt(b.nights) || 0), 0);
      return { prop, count: propBookings.length, revenue, advance, pending, nights };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  // ── 5. Key Insights ─────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const totalRevenue = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);
    const topProperty  = propertyBreakdown[0];
    const topSource    = sourceData[0];
    const thisMonth    = new Date().getMonth();
    const thisYear     = new Date().getFullYear();
    const thisMonthRev = bookings
      .filter((b) => { const d = new Date(b.checkIn); return d.getMonth() === thisMonth && d.getFullYear() === thisYear; })
      .reduce((s, b) => s + (b.totalPrice || 0), 0);
    return { totalRevenue, topProperty, topSource, thisMonthRev };
  }, [bookings, propertyBreakdown, sourceData]);

  if (bookings.length === 0) {
    return (
      <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h3 style={{ marginBottom: 8 }}>No data yet</h3>
        <p style={{ fontSize: 14 }}>Add some bookings first and your charts will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Top insight cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { icon: "💰", label: "All-Time Revenue",    value: fmt(insights.totalRevenue),           color: "rgba(212,168,83,0.15)" },
          { icon: "📅", label: "This Month Revenue",  value: fmt(insights.thisMonthRev),            color: "rgba(78,205,196,0.15)" },
          { icon: "🏆", label: "Top Property",        value: insights.topProperty?.prop || "—",     color: "rgba(167,139,250,0.15)" },
          { icon: "📲", label: "Top Booking Source",  value: insights.topSource?.name  || "—",      color: "rgba(249,115,22,0.15)" },
        ].map((c) => (
          <div key={c.label} className="card" style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              {c.icon}
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{c.label}</p>
              <p style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 600, marginTop: 2 }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Month range selector ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Showing:</span>
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            onClick={() => setMonthRange(n)}
            className="btn"
            style={{
              padding: "5px 14px", fontSize: 12,
              background: monthRange === n ? "var(--accent-gold-dim)" : "transparent",
              border: monthRange === n ? "1px solid var(--border-accent)" : "1px solid var(--border)",
              color: monthRange === n ? "var(--accent-gold)" : "var(--text-secondary)",
              fontWeight: monthRange === n ? 600 : 400,
            }}
          >
            {n} months
          </button>
        ))}
      </div>

      {/* ── 1. Revenue Chart ── */}
      <ChartCard
        title="📈 Monthly Revenue"
        subtitle="Total revenue collected per month, broken down by property"
        insight={`Best month: ${revenueData.reduce((best, d) => d.total > best.total ? d : best, revenueData[0])?.month}`}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: "#9994a8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: "#9994a8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip type="currency" />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#9994a8", paddingTop: 12 }} />
            {properties.map((prop) => (
              <Bar key={prop} dataKey={prop} stackId="a" fill={PROPERTY_COLORS[prop]} radius={prop === properties[properties.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 2. Occupancy Rate Chart ── */}
      <ChartCard
        title="🏠 Occupancy Rate"
        subtitle="Percentage of days each property was booked per month"
        insight="100% = fully booked all month"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={occupancyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: "#9994a8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#9994a8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip type="percent" />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#9994a8", paddingTop: 12 }} />
            {properties.map((prop) => (
              <Line
                key={prop} type="monotone" dataKey={prop}
                stroke={PROPERTY_COLORS[prop]} strokeWidth={2.5}
                dot={{ r: 4, fill: PROPERTY_COLORS[prop] }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 3. Source Pie + Property Breakdown side by side ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>

        {/* Pie chart */}
        <div className="card" style={{ padding: "24px 28px" }}>
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>📲 Booking Sources</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
            Where your bookings are coming from
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%" cy="50%"
                innerRadius={70} outerRadius={100}
                dataKey="value"
                activeIndex={pieIndex}
                activeShape={ActivePieShape}
                onMouseEnter={(_, i) => setPieIndex(i)}
              >
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 8 }}>
            {sourceData.map((s, i) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: SOURCE_COLORS[i % SOURCE_COLORS.length], flexShrink: 0 }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </div>

        {/* Property breakdown table */}
        <div className="card" style={{ padding: "24px 28px" }}>
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>🏆 Property Breakdown</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
            Revenue and bookings per property
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {propertyBreakdown.map(({ prop, count, revenue, pending, nights }) => {
              const totalRev = propertyBreakdown.reduce((s, p) => s + p.revenue, 0);
              const pct = totalRev ? Math.round((revenue / totalRev) * 100) : 0;
              return (
                <div key={prop}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: PROPERTY_COLORS[prop] }} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{prop}</span>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--accent-gold)", fontWeight: 600 }}>{fmt(revenue)}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ background: "var(--bg-input)", borderRadius: 99, height: 6, marginBottom: 4 }}>
                    <div style={{ background: PROPERTY_COLORS[prop], borderRadius: 99, height: 6, width: `${pct}%`, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                    <span>{count} bookings · {nights} nights</span>
                    <span style={{ color: pending > 0 ? "var(--accent-rose)" : "var(--text-muted)" }}>
                      {pending > 0 ? `${fmt(pending)} pending` : "All paid ✓"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. Monthly bookings count ── */}
      <ChartCard
        title="📋 Booking Volume"
        subtitle="Number of new bookings added each month"
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={months.map(({ label, year, month }) => ({
              month: label,
              Bookings: bookings.filter((b) => {
                const d = new Date(b.checkIn);
                return d.getFullYear() === year && d.getMonth() === month;
              }).length,
            }))}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fill: "#9994a8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#9994a8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip type="count" />} />
            <Bar dataKey="Bookings" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
