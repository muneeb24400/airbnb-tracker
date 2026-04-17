/**
 * EditBookingModal.jsx
 * Pre-filled modal for editing an existing booking.
 * Also handles: status changes, cancellation with reason + refund tracking.
 */
import React, { useState, useEffect } from "react";

const SOURCES = [
  "WhatsApp","Phone Call","Instagram","Facebook",
  "Airbnb","Booking.com","Walk-in","Other",
];

const PROPERTIES = [
  "Icon 613",
  "Citysmart",
  "Gulberg Outsource",
  "Bahria Enclave Outsource",
];

const STATUSES = ["Upcoming","Active","Completed","Cancelled"];

const BASE_URL = process.env.REACT_APP_API_URL || "";

export default function EditBookingModal({ booking, onClose, onSaved }) {
  const [form,         setForm]         = useState({});
  const [loading,      setLoading]      = useState(false);
  const [cancelMode,   setCancelMode]   = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundIssued, setRefundIssued] = useState("No");
  const [error,        setError]        = useState("");

  // Pre-fill form with existing booking data
  useEffect(() => {
    if (booking) {
      setForm({ ...booking });
      if (booking.status === "Cancelled") setCancelMode(true);
    }
  }, [booking]);

  if (!booking) return null;

  const remaining =
    (parseFloat(form.totalPrice) || 0) - (parseFloat(form.advancePaid) || 0);

  const nights =
    form.checkIn && form.checkOut
      ? Math.max(0, Math.ceil(
          (new Date(form.checkOut) - new Date(form.checkIn)) / (1000 * 60 * 60 * 24)
        ))
      : 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ── Save edits ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.guestName || !form.checkIn || !form.checkOut || !form.property) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${booking.bookingId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        onSaved("Booking updated successfully! ✅");
        onClose();
      } else {
        setError(data.message || "Update failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel booking ──────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError("Please enter a cancellation reason.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/api/bookings/${booking.bookingId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "Cancelled", cancelReason, refundIssued }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved("Booking cancelled and logged. ❌");
        onClose();
      } else {
        setError(data.message || "Cancellation failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── Status-only change ──────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (newStatus === "Cancelled") { setCancelMode(true); return; }
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/api/bookings/${booking.bookingId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      setForm((prev) => ({ ...prev, status: newStatus }));
      onSaved(`Status changed to ${newStatus}`);
      onClose();
    } catch {
      setError("Status update failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Status badge colour ─────────────────────────────────────────────────────
  const statusColour = {
    Upcoming:  { bg: "rgba(78,205,196,0.15)",  text: "#4ecdc4" },
    Active:    { bg: "rgba(81,207,102,0.12)",  text: "#51cf66" },
    Completed: { bg: "rgba(90,88,112,0.3)",    text: "#9994a8" },
    Cancelled: { bg: "rgba(255,107,107,0.15)", text: "#ff6b6b" },
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 200, backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 201, width: "min(860px, 95vw)",
        maxHeight: "90vh", overflowY: "auto",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "24px 28px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>✏️ Edit Booking</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {booking.bookingId} · {booking.guestName}
            </p>
          </div>
          {/* Status selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Status:</span>
            <select
              value={form.status || "Upcoming"}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                background: statusColour[form.status]?.bg || "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: statusColour[form.status]?.text || "var(--text-primary)",
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 10px",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}
            >✕</button>
          </div>
        </div>

        {/* Cancellation mode */}
        {cancelMode ? (
          <div style={{ padding: "28px" }}>
            <div style={{
              background: "rgba(255,107,107,0.08)",
              border: "1px solid rgba(255,107,107,0.3)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              marginBottom: 20,
            }}>
              <h3 style={{ color: "var(--accent-rose)", marginBottom: 4, fontSize: 16 }}>
                ❌ Cancel This Booking
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                This will mark the booking as cancelled and log the reason.
              </p>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div className="form-group">
                <label>Cancellation Reason *</label>
                <input
                  placeholder="e.g. Guest cancelled, no show, emergency…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Refund Issued?</label>
                <select
                  value={refundIssued}
                  onChange={(e) => setRefundIssued(e.target.value)}
                >
                  <option value="No">No refund</option>
                  <option value="Full">Full refund</option>
                  <option value="Partial">Partial refund</option>
                </select>
              </div>
            </div>

            {error && (
              <p style={{ color: "var(--accent-rose)", fontSize: 13, marginTop: 12 }}>❌ {error}</p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button className="btn btn-danger" onClick={handleCancel} disabled={loading} style={{ minWidth: 160 }}>
                {loading ? "Cancelling…" : "❌ Confirm Cancellation"}
              </button>
              <button className="btn btn-ghost" onClick={() => setCancelMode(false)}>
                Go Back
              </button>
            </div>
          </div>
        ) : (
          /* Edit form */
          <div style={{ padding: "24px 28px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label>Guest Name *</label>
                <input name="guestName" value={form.guestName || ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input name="phone" value={form.phone || ""} onChange={handleChange} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label>Property *</label>
                <select name="property" value={form.property || ""} onChange={handleChange}>
                  {PROPERTIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Guests</label>
                <input type="number" name="guests" min="1" max="20"
                  value={form.guests || 1} onChange={handleChange} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label>Check-in *</label>
                <input type="date" name="checkIn" value={form.checkIn || ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Check-out *</label>
                <input type="date" name="checkOut" value={form.checkOut || ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Nights</label>
                <input value={nights ? `${nights} night${nights !== 1 ? "s" : ""}` : "—"}
                  readOnly style={{ background: "var(--bg-secondary)", color: "var(--accent-gold)" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label>Total Price (PKR)</label>
                <input type="number" name="totalPrice"
                  value={form.totalPrice || ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Advance Paid (PKR)</label>
                <input type="number" name="advancePaid"
                  value={form.advancePaid || ""} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Remaining (Auto)</label>
                <input value={`PKR ${remaining.toLocaleString()}`} readOnly
                  style={{ background: "var(--bg-secondary)",
                    color: remaining > 0 ? "var(--accent-rose)" : "var(--accent-green)",
                    fontWeight: 600 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 24 }}>
              <div className="form-group">
                <label>Booking Source</label>
                <select name="source" value={form.source || "WhatsApp"} onChange={handleChange}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input name="notes" value={form.notes || ""} onChange={handleChange}
                  placeholder="Special requests, notes…" />
              </div>
            </div>

            {error && (
              <p style={{ color: "var(--accent-rose)", fontSize: 13, marginBottom: 16 }}>❌ {error}</p>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={loading} style={{ minWidth: 140 }}>
                {loading ? "Saving…" : "💾 Save Changes"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn"
                onClick={() => setCancelMode(true)}
                style={{
                  marginLeft: "auto",
                  background: "rgba(255,107,107,0.1)",
                  border: "1px solid rgba(255,107,107,0.2)",
                  color: "var(--accent-rose)", fontSize: 13,
                }}
              >
                ❌ Cancel Booking
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
