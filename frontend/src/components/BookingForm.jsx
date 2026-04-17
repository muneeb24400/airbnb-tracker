/**
 * BookingForm.jsx
 * Booking form with property dropdown and date overlap validation.
 * Icon 613 and Citysmart block overlapping bookings.
 * Gulberg Outsource and Bahria Enclave allow overlapping bookings.
 */
import React, { useState } from "react";

// ─── Initial empty form state ─────────────────────────────────────────────────
const EMPTY_FORM = {
  guestName: "",
  phone: "",
  checkIn: "",
  checkOut: "",
  guests: 1,
  property: "",  // Will be set to first property on render
  totalPrice: "",
  advancePaid: "",
  source: "WhatsApp",
  notes: "",
};

// ─── Fallback properties (used only if API hasn't loaded yet) ────────────────
const FALLBACK_PROPERTIES = [
  { name: "Icon 613",                 noOverlap: true  },
  { name: "Citysmart",                noOverlap: true  },
  { name: "Gulberg Outsource",        noOverlap: false },
  { name: "Bahria Enclave Outsource", noOverlap: false },
];

const SOURCES = [
  "WhatsApp", "Phone Call", "Instagram",
  "Facebook", "Airbnb", "Booking.com", "Walk-in", "Other",
];

// ─── Check if two date ranges overlap ────────────────────────────────────────
// Two bookings overlap when one starts before the other ends.
// We treat same-day checkout/checkin as NOT an overlap (back-to-back is fine).
function datesOverlap(existingCheckIn, existingCheckOut, newCheckIn, newCheckOut) {
  const eIn  = new Date(existingCheckIn);
  const eOut = new Date(existingCheckOut);
  const nIn  = new Date(newCheckIn);
  const nOut = new Date(newCheckOut);
  // Overlap if: new check-in is before existing check-out
  //         AND new check-out is after existing check-in
  return nIn < eOut && nOut > eIn;
}

export default function BookingForm({ onSubmit, loading, existingBookings = [], dynamicProperties = [] }) {
  // Use API properties if available, fall back to hardcoded ones
  const PROPERTIES = dynamicProperties.length > 0 ? dynamicProperties : FALLBACK_PROPERTIES;
  const OVERLAP_CHECKED = new Set(PROPERTIES.filter((p) => p.noOverlap).map((p) => p.name));
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [overlapError, setOverlapError] = useState("");

  // ─── Auto-calculate remaining amount ───────────────────────────────────────
  const remaining =
    (parseFloat(form.totalPrice) || 0) - (parseFloat(form.advancePaid) || 0);

  // ─── Calculate nights dynamically ──────────────────────────────────────────
  const nights =
    form.checkIn && form.checkOut
      ? Math.max(
          0,
          Math.ceil(
            (new Date(form.checkOut) - new Date(form.checkIn)) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

  // ─── Check for overlapping bookings in real-time ───────────────────────────
  // Runs whenever property, checkIn, or checkOut changes
  const checkOverlap = (property, checkIn, checkOut) => {
    // Only validate properties that require it
    if (!OVERLAP_CHECKED.has(property) || !checkIn || !checkOut) {
      setOverlapError("");
      return false;
    }

    // Find any existing booking for the same property with overlapping dates
    const conflict = existingBookings.find(
      (b) =>
        b.property === property &&
        b.status !== "Completed" &&
        datesOverlap(b.checkIn, b.checkOut, checkIn, checkOut)
    );

    if (conflict) {
      setOverlapError(
        `🚫 This apartment is already reserved at this time. ` +
        `(${conflict.guestName} — ${conflict.checkIn} to ${conflict.checkOut})`
      );
      return true;
    }

    setOverlapError("");
    return false;
  };

  // ─── Handle input changes ───────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);

    // Clear field-level error on change
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));

    // Re-check overlap whenever relevant fields change
    if (["property", "checkIn", "checkOut"].includes(name)) {
      checkOverlap(updated.property, updated.checkIn, updated.checkOut);
    }
  };

  // ─── Validate form ──────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!form.guestName.trim()) newErrors.guestName = "Guest name is required";
    if (!form.checkIn)          newErrors.checkIn   = "Check-in date is required";
    if (!form.checkOut)         newErrors.checkOut  = "Check-out date is required";
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn)
      newErrors.checkOut = "Check-out must be after check-in";
    if (form.totalPrice  && isNaN(parseFloat(form.totalPrice)))
      newErrors.totalPrice  = "Enter a valid number";
    if (form.advancePaid && isNaN(parseFloat(form.advancePaid)))
      newErrors.advancePaid = "Enter a valid number";
    return newErrors;
  };

  // ─── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    // Run field validation
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Run overlap check one final time before submitting
    const hasOverlap = checkOverlap(form.property, form.checkIn, form.checkOut);
    if (hasOverlap) return; // Stop — overlap error is already shown

    onSubmit(form, () => {
      setForm(EMPTY_FORM);
      setOverlapError("");
    });
  };

  // ─── Style helpers ──────────────────────────────────────────────────────────
  const fieldStyle = (name) => ({
    borderColor: errors[name] ? "var(--accent-rose)" : undefined,
  });

  // ─── Which property is currently selected ──────────────────────────────────
  const selectedProp  = PROPERTIES.find((p) => p.name === form.property);
  const isNoOverlap   = selectedProp?.noOverlap;

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
            {errors.guestName && (
              <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.guestName}</span>
            )}
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

        {/* ── Row 2: Property & Guests Count ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label>Property / Room Name *</label>
            <select
              name="property"
              value={form.property}
              onChange={handleChange}
              style={{
                borderColor: overlapError ? "var(--accent-rose)" : undefined,
              }}
            >
              {PROPERTIES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}{p.noOverlap ? " 🔒" : ""}
                </option>
              ))}
            </select>
            {/* Show which mode is active */}
            <span style={{
              fontSize: 11,
              color: isNoOverlap ? "var(--accent-teal)" : "var(--text-muted)",
              marginTop: 2,
            }}>
              {isNoOverlap
                ? "🔒 Overlap protection ON — cannot double-book this property"
                : "✅ Overlap allowed — multiple bookings can share dates"}
            </span>
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

        {/* ── Row 3: Dates ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group">
            <label>Check-in Date *</label>
            <input
              type="date"
              name="checkIn"
              value={form.checkIn}
              onChange={handleChange}
              style={{
                borderColor:
                  errors.checkIn || overlapError ? "var(--accent-rose)" : undefined,
              }}
            />
            {errors.checkIn && (
              <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.checkIn}</span>
            )}
          </div>
          <div className="form-group">
            <label>Check-out Date *</label>
            <input
              type="date"
              name="checkOut"
              value={form.checkOut}
              onChange={handleChange}
              style={{
                borderColor:
                  errors.checkOut || overlapError ? "var(--accent-rose)" : undefined,
              }}
            />
            {errors.checkOut && (
              <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.checkOut}</span>
            )}
          </div>
          <div className="form-group">
            <label>Nights</label>
            <input
              value={nights ? `${nights} night${nights !== 1 ? "s" : ""}` : "—"}
              readOnly
              style={{
                background: "var(--bg-secondary)",
                cursor: "default",
                color: "var(--accent-gold)",
              }}
            />
          </div>
        </div>

        {/* ── Overlap Error Banner ── */}
        {overlapError && (
          <div
            style={{
              background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.4)",
              borderRadius: "var(--radius-sm)",
              color: "var(--accent-rose)",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16,
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>🚫</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                This apartment is already reserved at this time
              </div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                {overlapError.replace("🚫 This apartment is already reserved at this time. ", "")}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
                Please choose different dates or select another property.
              </div>
            </div>
          </div>
        )}

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
            {errors.totalPrice && (
              <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.totalPrice}</span>
            )}
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
            {errors.advancePaid && (
              <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>{errors.advancePaid}</span>
            )}
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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !!overlapError}
            style={{ minWidth: 160 }}
          >
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
            onClick={() => { setForm(EMPTY_FORM); setErrors({}); setOverlapError(""); }}
            disabled={loading}
          >
            Clear
          </button>

          {/* Remind user why button is disabled */}
          {overlapError && (
            <span style={{ color: "var(--accent-rose)", fontSize: 12 }}>
              Fix the date conflict above to continue
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
