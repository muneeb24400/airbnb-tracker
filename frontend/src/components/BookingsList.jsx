/**
 * BookingsList.jsx
 * Displays all bookings in a table with filters, search, edit, and delete.
 * Highlights upcoming check-ins within 3 days.
 */
import React, { useState, useMemo } from "react";
import { exportToCSV } from "../utils/api";

// ─── Source emoji map ─────────────────────────────────────────────────────────
const SOURCE_ICONS = {
  WhatsApp: "💬",
  "Phone Call": "📞",
  Instagram: "📸",
  Facebook: "👥",
  Airbnb: "🏠",
  "Booking.com": "🌐",
  "Walk-in": "🚶",
  Other: "📝",
};

// ─── Format currency ──────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n || 0);

// ─── Format date to readable ──────────────────────────────────────────────────
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
    : "—";

// ─── Check if check-in is within 3 days ──────────────────────────────────────
const isUpcomingSoon = (checkIn) => {
  const today = new Date();
  const ci = new Date(checkIn);
  const diff = (ci - today) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
};

export default function BookingsList({ bookings, onDelete, deleteLoading, onEdit, onInvoice }) {
  const [search, setSearch] = useState("");
  const [filterProperty, setFilterProperty] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDir, setSortDir] = useState("desc");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ─── Unique properties for filter dropdown ──────────────────────────────────
  const properties = useMemo(() => {
    const unique = [...new Set(bookings.map((b) => b.property).filter(Boolean))];
    return ["All", ...unique];
  }, [bookings]);

  // ─── Filter + search + sort ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          b.guestName?.toLowerCase().includes(q) ||
          b.property?.toLowerCase().includes(q) ||
          b.phone?.includes(q) ||
          b.bookingId?.toLowerCase().includes(q);
        const matchProp = filterProperty === "All" || b.property === filterProperty;
        const matchStatus = filterStatus === "All" || b.status === filterStatus;
        return matchSearch && matchProp && matchStatus;
      })
      .sort((a, b) => {
        let aVal = a[sortField] || "";
        let bVal = b[sortField] || "";
        if (sortField === "totalPrice" || sortField === "remaining") {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [bookings, search, filterProperty, filterStatus, sortField, sortDir]);

  // ─── Sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";

  // ─── Delete flow ────────────────────────────────────────────────────────────
  const handleDeleteClick = (id) => setConfirmDelete(id);
  const handleDeleteConfirm = async () => {
    if (confirmDelete) {
      await onDelete(confirmDelete);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="card fade-in" style={{ overflow: "hidden" }}>
      {/* ── Toolbar ── */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: 20, flex: "1 1 auto" }}>All Bookings</h2>

        {/* Search */}
        <input
          placeholder="🔍  Search guest, property…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "8px 14px",
            width: 200,
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
        />

        {/* Property filter */}
        <select
          value={filterProperty}
          onChange={(e) => setFilterProperty(e.target.value)}
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "8px 12px",
            fontFamily: "var(--font-body)",
            cursor: "pointer",
          }}
        >
          {properties.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "8px 12px",
            fontFamily: "var(--font-body)",
            cursor: "pointer",
          }}
        >
          {["All", "Upcoming", "Active", "Completed", "Cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Export CSV */}
        <button
          className="btn btn-ghost"
          onClick={() => exportToCSV(filtered)}
          style={{ fontSize: 13, padding: "8px 14px" }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
          <p style={{ fontSize: 15 }}>No bookings found</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Try adjusting your filters or add a new booking.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                {[
                  { label: "Guest", field: "guestName" },
                  { label: "Property", field: "property" },
                  { label: "Check-in", field: "checkIn" },
                  { label: "Check-out", field: "checkOut" },
                  { label: "Nights", field: "nights" },
                  { label: "Total", field: "totalPrice" },
                  { label: "Advance", field: "advancePaid" },
                  { label: "Remaining", field: "remaining" },
                  { label: "Source", field: "source" },
                  { label: "Status", field: "status" },
                  { label: "", field: null },
                ].map(({ label, field }) => (
                  <th
                    key={label}
                    onClick={() => field && toggleSort(field)}
                    style={{
                      padding: "11px 14px",
                      textAlign: "left",
                      color: "var(--text-secondary)",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      fontSize: 11,
                      textTransform: "uppercase",
                      cursor: field ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}{field && <SortIcon field={field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => {
                const soon = isUpcomingSoon(b.checkIn) && b.status === "Upcoming";
                return (
                  <tr
                    key={b.bookingId || i}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: soon ? "rgba(212, 168, 83, 0.04)" : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = soon ? "rgba(212, 168, 83, 0.04)" : "transparent")}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{b.guestName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{b.phone}</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{b.property}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ color: soon ? "var(--accent-gold)" : "var(--text-primary)" }}>
                        {fmtDate(b.checkIn)}
                        {soon && " 🔔"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{fmtDate(b.checkOut)}</td>
                    <td style={{ padding: "12px 14px", color: "var(--text-muted)", textAlign: "center" }}>{b.nights}</td>
                    <td style={{ padding: "12px 14px", color: "var(--accent-gold)", fontWeight: 500 }}>{fmt(b.totalPrice)}</td>
                    <td style={{ padding: "12px 14px", color: "var(--accent-green)" }}>{fmt(b.advancePaid)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: b.remaining > 0 ? "rgba(255,107,107,0.12)" : "rgba(81,207,102,0.1)",
                        border: `1px solid ${b.remaining > 0 ? "rgba(255,107,107,0.25)" : "rgba(81,207,102,0.2)"}`,
                        borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                        color: b.remaining > 0 ? "var(--accent-rose)" : "var(--accent-green)",
                        whiteSpace: "nowrap",
                      }}>
                        {b.remaining > 0 ? "⏳" : "✅"} {fmt(b.remaining)}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                      {SOURCE_ICONS[b.source] || "📝"} {b.source}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className={`badge badge-${(b.status || "upcoming").toLowerCase()}`}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Invoice button */}
                        <button
                          className="btn btn-ghost"
                          onClick={() => onInvoice && onInvoice(b)}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          title="Generate invoice"
                        >
                          🧾
                        </button>
                        {/* Edit button */}
                        <button
                          className="btn btn-ghost"
                          onClick={() => onEdit && onEdit(b)}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          title="Edit booking"
                        >
                          ✏️
                        </button>
                        {/* Delete button */}
                        {confirmDelete === b.bookingId ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-danger" onClick={handleDeleteConfirm}
                              disabled={deleteLoading} style={{ padding: "4px 8px", fontSize: 12 }}>
                              Yes
                            </button>
                            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}
                              style={{ padding: "4px 8px", fontSize: 12 }}>
                              No
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost" onClick={() => handleDeleteClick(b.bookingId)}
                            style={{ padding: "4px 10px", fontSize: 12, color: "var(--text-muted)" }}
                            title="Delete booking">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer count ── */}
      {filtered.length > 0 && (
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border)",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          Showing {filtered.length} of {bookings.length} bookings
        </div>
      )}
    </div>
  );
}
