/**
 * CalendarView.jsx
 * Monthly calendar showing bookings as colour-coded blocks.
 * Filters: Property, Booking Source
 * Click a booking block to see details.
 */
import React, { useState, useMemo } from "react";

// ─── Property colours ─────────────────────────────────────────────────────────
const PROP_COLORS = [
  { bg: "#d4a853", text: "#0f0f1a" },
  { bg: "#4ecdc4", text: "#0f0f1a" },
  { bg: "#a78bfa", text: "#0f0f1a" },
  { bg: "#f97316", text: "#0f0f1a" },
  { bg: "#51cf66", text: "#0f0f1a" },
  { bg: "#ff6b6b", text: "#fff"    },
  { bg: "#74c0fc", text: "#0f0f1a" },
  { bg: "#f783ac", text: "#0f0f1a" },
];

const STATUS_OPACITY = { Upcoming: 1, Active: 1, Completed: 0.5, Cancelled: 0.3 };

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
  : "—";

const fmt = (n) => new Intl.NumberFormat("en-PK", {
  style: "currency", currency: "PKR", maximumFractionDigits: 0,
}).format(n || 0);

// ─── Build colour map for properties ─────────────────────────────────────────
function buildColorMap(bookings) {
  const props = [...new Set(bookings.map((b) => b.property).filter(Boolean))];
  const map   = {};
  props.forEach((p, i) => { map[p] = PROP_COLORS[i % PROP_COLORS.length]; });
  return map;
}

// ─── Get all days in a month as Date objects ──────────────────────────────────
function getDaysInMonth(year, month) {
  const days = [];
  const d    = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Check if a booking spans a given date ───────────────────────────────────
function bookingCoversDate(booking, date) {
  const ci  = new Date(booking.checkIn);
  const co  = new Date(booking.checkOut);
  const day = new Date(date);
  // Inclusive check-in, exclusive check-out
  return day >= ci && day < co;
}

// ─── Booking detail popup ─────────────────────────────────────────────────────
function BookingPopup({ booking, color, onClose, onInvoice }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 401, width: "min(420px, 92vw)",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.2s ease", overflow: "hidden",
      }}>
        {/* Colour header */}
        <div style={{ background: color?.bg || "#d4a853", padding: "18px 22px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ fontSize: 18, color: color?.text || "#0f0f1a", fontFamily: "var(--font-display)" }}>
              {booking.guestName}
            </h3>
            <p style={{ fontSize: 13, color: color?.text || "#0f0f1a", opacity: 0.8, marginTop: 2 }}>
              {booking.property} · {booking.bookingId}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.15)",
            border: "none", borderRadius: 6, color: color?.text || "#0f0f1a",
            cursor: "pointer", fontSize: 18, padding: "2px 8px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Details */}
        <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "Check-in",  value: fmtDate(booking.checkIn)  },
            { label: "Check-out", value: fmtDate(booking.checkOut) },
            { label: "Nights",    value: `${booking.nights} nights` },
            { label: "Guests",    value: `${booking.guests} guests` },
            { label: "Phone",     value: booking.phone || "—" },
            { label: "Source",    value: booking.source || "—" },
            { label: "Total",     value: fmt(booking.totalPrice),   highlight: "var(--accent-gold)" },
            { label: "Advance",   value: fmt(booking.advancePaid),  highlight: "var(--accent-green)" },
            { label: "Remaining", value: fmt(booking.remaining),
              highlight: (booking.remaining || 0) > 0 ? "var(--accent-rose)" : "var(--text-muted)" },
            { label: "Status",    value: booking.status },
          ].map(({ label, value, highlight }) => (
            <div key={label}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase",
                letterSpacing: "0.06em", fontWeight: 500, marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: highlight || "var(--text-primary)" }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {booking.notes && (
          <div style={{ margin: "0 22px 16px", background: "var(--bg-secondary)",
            borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text-secondary)" }}>
            📝 {booking.notes}
          </div>
        )}

        <div style={{ padding: "12px 22px 20px", display: "flex", gap: 10 }}>
          {onInvoice && (
            <button className="btn btn-primary" onClick={() => { onInvoice(booking); onClose(); }}
              style={{ flex: 1, fontSize: 13 }}>
              🧾 Generate Invoice
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>Close</button>
        </div>
      </div>
    </>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────
export default function CalendarView({ bookings, onInvoice }) {
  const today      = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filterProp,   setFilterProp]   = useState("All");
  const [filterSource, setFilterSource] = useState("All");
  const [selected, setSelected] = useState(null); // selected booking for popup

  const colorMap = useMemo(() => buildColorMap(bookings), [bookings]);

  // Unique properties and sources for filters
  const properties = useMemo(() => ["All", ...new Set(bookings.map((b) => b.property).filter(Boolean))], [bookings]);
  const sources    = useMemo(() => ["All", ...new Set(bookings.map((b) => b.source).filter(Boolean))],   [bookings]);

  // Filtered bookings
  const filtered = useMemo(() => bookings.filter((b) => {
    const matchProp   = filterProp   === "All" || b.property === filterProp;
    const matchSource = filterSource === "All" || b.source   === filterSource;
    return matchProp && matchSource && b.status !== "Cancelled";
  }), [bookings, filterProp, filterSource]);

  // Calendar grid: days in month + leading blanks
  const days          = getDaysInMonth(year, month);
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const blanks         = Array(firstDayOfWeek).fill(null);
  const allCells       = [...blanks, ...days];

  // Prev / next month
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Bookings on a specific day
  const bookingsOnDay = (date) => filtered.filter((b) => bookingCoversDate(b, date));

  // Check if date is today
  const isToday = (date) => date.toDateString() === today.toDateString();

  return (
    <div>
      {/* ── Filters & nav ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
          <button className="btn btn-ghost" onClick={prevMonth}
            style={{ padding: "7px 12px", fontSize: 16 }}>‹</button>
          <h3 style={{ fontSize: 18, fontFamily: "var(--font-display)", minWidth: 180, textAlign: "center" }}>
            {MONTHS[month]} {year}
          </h3>
          <button className="btn btn-ghost" onClick={nextMonth}
            style={{ padding: "7px 12px", fontSize: 16 }}>›</button>
          <button className="btn btn-ghost" onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            style={{ padding: "6px 12px", fontSize: 12 }}>Today</button>
        </div>

        {/* Property filter */}
        <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)}
          style={{ background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-primary)", fontSize: 12,
            padding: "8px 12px", fontFamily: "var(--font-body)", cursor: "pointer" }}>
          {properties.map((p) => <option key={p} value={p}>{p === "All" ? "All Properties" : p}</option>)}
        </select>

        {/* Source filter */}
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
          style={{ background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-primary)", fontSize: 12,
            padding: "8px 12px", fontFamily: "var(--font-body)", cursor: "pointer" }}>
          {sources.map((s) => <option key={s} value={s}>{s === "All" ? "All Sources" : s}</option>)}
        </select>

        {/* Booking count */}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {filtered.filter((b) => {
            const ci = new Date(b.checkIn);
            const co = new Date(b.checkOut);
            return ci.getFullYear() === year && ci.getMonth() <= month &&
                   co.getFullYear() === year && co.getMonth() >= month ||
                   (ci.getFullYear() === year && ci.getMonth() === month) ||
                   (co.getFullYear() === year && co.getMonth() === month);
          }).length} bookings this month
        </span>
      </div>

      {/* ── Property colour legend ── */}
      {Object.keys(colorMap).length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {Object.entries(colorMap).map(([prop, color]) => (
            <div key={prop} style={{ display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "var(--text-secondary)" }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color.bg, flexShrink: 0 }} />
              {prop}
            </div>
          ))}
        </div>
      )}

      {/* ── Calendar grid ── */}
      <div className="card" style={{ overflow: "hidden" }}>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: "10px 0", textAlign: "center",
              fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
              letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {allCells.map((date, idx) => {
            if (!date) {
              return <div key={`blank-${idx}`} style={{
                minHeight: 100, borderRight: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-secondary)", opacity: 0.4,
              }} />;
            }

            const dayBookings = bookingsOnDay(date);
            const isCurrentDay = isToday(date);
            const isWeekend    = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div key={date.toISOString()} style={{
                minHeight: 100,
                borderRight: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                padding: "6px 5px",
                background: isCurrentDay ? "rgba(212,168,83,0.06)" : isWeekend ? "rgba(255,255,255,0.01)" : "transparent",
                transition: "background 0.15s",
                position: "relative",
              }}>
                {/* Date number */}
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: "50%",
                  fontSize: 12, fontWeight: isCurrentDay ? 700 : 400,
                  background: isCurrentDay ? "var(--accent-gold)" : "transparent",
                  color: isCurrentDay ? "#0f0f1a" : isWeekend ? "var(--text-secondary)" : "var(--text-primary)",
                  marginBottom: 4,
                }}>
                  {date.getDate()}
                </div>

                {/* Booking blocks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayBookings.slice(0, 3).map((b) => {
                    const color   = colorMap[b.property] || PROP_COLORS[0];
                    const opacity = STATUS_OPACITY[b.status] || 1;
                    const isStart = new Date(b.checkIn).toDateString() === date.toDateString();
                    const isEnd   = (() => {
                      const co = new Date(b.checkOut);
                      co.setDate(co.getDate() - 1);
                      return co.toDateString() === date.toDateString();
                    })();

                    return (
                      <div
                        key={b.bookingId}
                        onClick={() => setSelected(b)}
                        title={`${b.guestName} — ${b.property}`}
                        style={{
                          background: color.bg,
                          color: color.text,
                          opacity,
                          borderRadius: isStart ? "4px 0 0 4px" : isEnd ? "0 4px 4px 0" : "0",
                          fontSize: 10, fontWeight: 600,
                          padding: "2px 5px",
                          cursor: "pointer",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          transition: "filter 0.15s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.15)"}
                        onMouseLeave={(e) => e.currentTarget.style.filter = "brightness(1)"}
                      >
                        {isStart ? `▶ ${b.guestName}` : "·"}
                      </div>
                    );
                  })}
                  {dayBookings.length > 3 && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 2 }}>
                      +{dayBookings.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Booking detail popup ── */}
      {selected && (
        <BookingPopup
          booking={selected}
          color={colorMap[selected.property]}
          onClose={() => setSelected(null)}
          onInvoice={onInvoice}
        />
      )}
    </div>
  );
}
