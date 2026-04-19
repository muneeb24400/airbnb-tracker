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

export default function BookingsList({ bookings, onDelete, deleteLoading, onEdit, onInvoice, onComplete }) {
  const [search, setSearch] = useState("");
  const [filterProperty, setFilterProperty] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDir, setSortDir] = useState("desc");
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null); // bookingId awaiting completion confirm
  const [remainingInput,  setRemainingInput]  = useState("");   // payment amount entered before completing

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
                const soon       = isUpcomingSoon(b.checkIn) && b.status === "Upcoming";
                const isComplete = b.status === "Completed";
                const isCancelled = b.status === "Cancelled";

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
                    {/* Guest */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{b.guestName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{b.phone}</div>
                    </td>

                    {/* Property */}
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{b.property}</td>

                    {/* Check-in */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ color: soon ? "var(--accent-gold)" : "var(--text-primary)" }}>
                        {fmtDate(b.checkIn)}{soon && " 🔔"}
                      </span>
                    </td>

                    {/* Check-out */}
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{fmtDate(b.checkOut)}</td>

                    {/* Nights */}
                    <td style={{ padding: "12px 14px", color: "var(--text-muted)", textAlign: "center" }}>{b.nights}</td>

                    {/* Total */}
                    <td style={{ padding: "12px 14px", color: "var(--accent-gold)", fontWeight: 500 }}>{fmt(b.totalPrice)}</td>

                    {/* Advance */}
                    <td style={{ padding: "12px 14px", color: "var(--accent-green)" }}>{fmt(b.advancePaid)}</td>

                    {/* ── Remaining Payment Box ── */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{
                        background: b.remaining > 0
                          ? "rgba(255,107,107,0.1)"
                          : "rgba(81,207,102,0.08)",
                        border: `1px solid ${b.remaining > 0
                          ? "rgba(255,107,107,0.3)"
                          : "rgba(81,207,102,0.25)"}`,
                        borderRadius: 8,
                        padding: "6px 10px",
                        minWidth: 100,
                      }}>
                        <div style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          color: b.remaining > 0 ? "rgba(255,107,107,0.7)" : "rgba(81,207,102,0.7)",
                          marginBottom: 2,
                        }}>
                          {b.remaining > 0 ? "⏳ Remaining" : "✅ Fully Paid"}
                        </div>
                        <div style={{
                          fontSize: 13, fontWeight: 700,
                          color: b.remaining > 0 ? "var(--accent-rose)" : "var(--accent-green)",
                        }}>
                          {fmt(b.remaining)}
                        </div>
                      </div>
                    </td>

                    {/* Source */}
                    <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                      {SOURCE_ICONS[b.source] || "📝"} {b.source}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className={`badge badge-${(b.status || "upcoming").toLowerCase()}`}>
                        {b.status}
                      </span>
                    </td>

                    {/* ── Actions ── */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 120 }}>

                        {/* ── Complete Booking button / inline form ── */}
                        {!isComplete && !isCancelled && (
                          confirmComplete === b.bookingId ? (
                            // ── Inline payment collection form ──────────────
                            <div style={{
                              background: "rgba(81,207,102,0.06)",
                              border: "1px solid rgba(81,207,102,0.25)",
                              borderRadius: 8, padding: "8px 10px",
                              display: "flex", flexDirection: "column", gap: 6,
                            }}>
                              <p style={{
                                fontSize: 10, fontWeight: 700, color: "var(--accent-green)",
                                textTransform: "uppercase", letterSpacing: "0.06em",
                              }}>
                                💵 Payment Received
                              </p>
                              {/* Show outstanding balance as hint */}
                              {(b.remaining || 0) > 0 && (
                                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  Outstanding: {fmt(b.remaining)}
                                </p>
                              )}
                              <input
                                type="number"
                                placeholder={`Enter amount (PKR)`}
                                value={remainingInput}
                                onChange={(e) => setRemainingInput(e.target.value)}
                                autoFocus
                                style={{
                                  background: "var(--bg-input)",
                                  border: "1px solid rgba(81,207,102,0.4)",
                                  borderRadius: 6, color: "var(--text-primary)",
                                  fontFamily: "var(--font-body)",
                                  fontSize: 12, padding: "5px 8px",
                                  outline: "none", width: "100%",
                                }}
                              />
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  className="btn"
                                  onClick={() => {
                                    onComplete && onComplete(
                                      b.bookingId,
                                      parseFloat(remainingInput) || 0,
                                      b
                                    );
                                    setConfirmComplete(null);
                                    setRemainingInput("");
                                  }}
                                  style={{
                                    flex: 1, padding: "5px 8px", fontSize: 11, fontWeight: 700,
                                    background: "rgba(81,207,102,0.2)",
                                    border: "1px solid rgba(81,207,102,0.4)",
                                    color: "var(--accent-green)",
                                  }}
                                >
                                  ✅ Confirm
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  onClick={() => {
                                    setConfirmComplete(null);
                                    setRemainingInput("");
                                  }}
                                  style={{ padding: "5px 8px", fontSize: 11 }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            // ── Initial Complete button ──────────────────────
                            <button
                              className="btn"
                              onClick={() => {
                                setConfirmComplete(b.bookingId);
                                setRemainingInput(
                                  (b.remaining || 0) > 0
                                    ? String(b.remaining)
                                    : ""
                                );
                              }}
                              style={{
                                padding: "5px 10px", fontSize: 11, fontWeight: 600,
                                background: "rgba(81,207,102,0.1)",
                                border: "1px solid rgba(81,207,102,0.25)",
                                color: "var(--accent-green)",
                                width: "100%",
                              }}
                              title="Mark as completed"
                            >
                              ✅ Complete
                            </button>
                          )
                        )}

                        {/* Row 2: Invoice + Edit + Delete */}
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => onInvoice && onInvoice(b)}
                            style={{ padding: "4px 8px", fontSize: 12, flex: 1 }}
                            title="Generate invoice"
                          >
                            🧾
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => onEdit && onEdit(b)}
                            style={{ padding: "4px 8px", fontSize: 12, flex: 1 }}
                            title="Edit booking"
                          >
                            ✏️
                          </button>
                          {confirmDelete === b.bookingId ? (
                            <>
                              <button className="btn btn-danger"
                                onClick={handleDeleteConfirm}
                                disabled={deleteLoading}
                                style={{ padding: "4px 7px", fontSize: 11 }}>
                                Yes
                              </button>
                              <button className="btn btn-ghost"
                                onClick={() => setConfirmDelete(null)}
                                style={{ padding: "4px 7px", fontSize: 11 }}>
                                No
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-ghost"
                              onClick={() => handleDeleteClick(b.bookingId)}
                              style={{ padding: "4px 8px", fontSize: 12, color: "var(--text-muted)", flex: 1 }}
                              title="Delete booking">
                              🗑️
                            </button>
                          )}
                        </div>
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
