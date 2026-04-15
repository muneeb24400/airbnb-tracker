/**
 * BookingForm.jsx
 * A full-featured booking form with auto-calculation of remaining amount.
 */
import React, { useState, useEffect } from "react";

// ─── Initial empty form state ─────────────────────────────────────────────────
const EMPTY_FORM = {
  guestName: "",
  phone: "",
  checkIn: "",
  checkOut: "",
  guests: 1,
  property: "",
  totalPrice: "",
  advancePaid: "",
  source: "WhatsApp",
  notes: "",
};

const SOURCES = ["WhatsApp", "Phone Call", "Instagram", "Facebook", "Airbnb", "Booking.com", "Walk-in", "Other"];

export default function BookingForm({ onSubmit, loading }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  // ─── Auto-calculate remaining amount ───────────────────────────────────────
  const remaining =
    (parseFloat(form.totalPrice) || 0) - (parseFloat(form.advancePaid) || 0);

  // ─── Calculate nights dynamically ──────────────────────────────────────────
  const nights =
    form.checkIn && form.checkOut
      ? Math.max(
          0,
          Math.ceil(
            (new Date(form.checkOut) - new Date(form.checkIn)) / (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  // ─── Handle input changes ───────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ─── Validate form ──────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!form.guestName.trim()) newErrors.guestName = "Guest name is required";
    if (!form.checkIn) newErrors.checkIn = "Check-in date is required";
    if (!form.checkOut) newErrors.checkOut = "Check-out date is required";
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn)
      newErrors.checkOut = "Check-out must be after check-in";
    if (!form.property.trim()) newErrors.property = "Property name is required";
    if (form.totalPrice && isNaN(parseFloat(form.totalPrice)))
      newErrors.totalPrice = "Enter a valid number";
    if (form.advancePaid && isNaN(parseFloat(form.advancePaid)))
      newErrors.advancePaid = "Enter a valid number";
    return newErrors;
  };

  // ─── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(form, () => setForm(EMPTY_FORM));
  };

  // ─── Style helpers ──────────────────────────────────────────────────────────
  const fieldStyle = (name) => ({
    borderColor: errors[name] ? "var(--accent-rose)" : undefined,
  });

  return (
    <div className="card fade-in" style={{ padding: "28px 32px" }}>
      {/* Form Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>New Booking</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Fill in the details below — remaining amount is calculated automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Row 1: Guest Info ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label>Guest Name *</label>
            <input
              name="guestName"
              placeholder="e.g. Ahmed Khan"
              value={form.guestName}
              onChange={handleChange}
              style={fieldStyle("guestName")}
            />
            {errors.guestName && <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.guestName}</span>}
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input
              name="phone"
              placeholder="+92 300 1234567"
              value={form.phone}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ── Row 2: Dates & Guests ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label>Check-in Date *</label>
            <input
              type="date"
              name="checkIn"
              value={form.checkIn}
              onChange={handleChange}
              style={fieldStyle("checkIn")}
            />
            {errors.checkIn && <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.checkIn}</span>}
          </div>
          <div className="form-group">
            <label>Check-out Date *</label>
            <input
              type="date"
              name="checkOut"
              value={form.checkOut}
              onChange={handleChange}
              style={fieldStyle("checkOut")}
            />
            {errors.checkOut && <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.checkOut}</span>}
          </div>
          <div className="form-group">
            <label>Nights</label>
            <input
              value={nights ? `${nights} night${nights !== 1 ? "s" : ""}` : "—"}
              readOnly
              style={{ background: "var(--bg-secondary)", cursor: "default", color: "var(--accent-gold)" }}
            />
          </div>
        </div>

        {/* ── Row 3: Property & Guests Count ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label>Property / Room Name *</label>
            <input
              name="property"
              placeholder="e.g. Sea View Suite, Room 4"
              value={form.property}
              onChange={handleChange}
              style={fieldStyle("property")}
            />
            {errors.property && <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.property}</span>}
          </div>
          <div className="form-group">
            <label>Number of Guests</label>
            <input
              type="number"
              name="guests"
              min="1"
              max="20"
              value={form.guests}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ── Row 4: Pricing ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label>Total Price (PKR)</label>
            <input
              type="number"
              name="totalPrice"
              placeholder="0"
              value={form.totalPrice}
              onChange={handleChange}
              style={fieldStyle("totalPrice")}
            />
            {errors.totalPrice && <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.totalPrice}</span>}
          </div>
          <div className="form-group">
            <label>Advance Paid (PKR)</label>
            <input
              type="number"
              name="advancePaid"
              placeholder="0"
              value={form.advancePaid}
              onChange={handleChange}
              style={fieldStyle("advancePaid")}
            />
            {errors.advancePaid && <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.advancePaid}</span>}
          </div>
          <div className="form-group">
            <label>Remaining Amount (Auto)</label>
            <input
              value={`PKR ${remaining.toLocaleString()}`}
              readOnly
              style={{
                background: "var(--bg-secondary)",
                cursor: "default",
                color: remaining > 0 ? "var(--accent-rose)" : "var(--accent-green)",
                fontWeight: 600,
              }}
            />
          </div>
        </div>

        {/* ── Row 5: Source & Notes ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "24px" }}>
          <div className="form-group">
            <label>Booking Source</label>
            <select name="source" value={form.source} onChange={handleChange}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input
              name="notes"
              placeholder="Special requests, early check-in, etc."
              value={form.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ── Submit ── */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160 }}>
            {loading ? (
              <>
                <span style={{ animation: "pulse 1s infinite" }}>⏳</span>
                Saving…
              </>
            ) : (
              <>
                <span>➕</span>
                Add Booking
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setForm(EMPTY_FORM)}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
