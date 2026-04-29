/**
 * PropertiesManager.jsx
 * Settings page to manage properties dynamically.
 * Stores everything in the "Properties" tab in Google Sheets.
 * Features: Add, Edit, Delete, Photo URL, Overlap toggle, Price per night, Max guests
 */
import React, { useState, useEffect } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";
import { bizFetch, bizUrl } from "../utils/bizApi";

// ─── Empty form state ─────────────────────────────────────────────────────────

// ─── Compress & resize image to base64 ───────────────────────────────────────
// Resizes to max 400px wide, compresses to 50% quality (~15-25KB / ~20K chars)
// Google Sheets cell limit is 50,000 chars — this safely fits within that.
function compressImage(file, maxWidth = 400, quality = 0.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        // Scale down proportionally
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width  = maxWidth;
        }
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        // Convert to JPEG with compression
        const compressed = canvas.toDataURL("image/jpeg", quality);
        // Safety check — warn if still large
        if (compressed.length > 40000) {
          // Try even harder compression
          resolve(canvas.toDataURL("image/jpeg", 0.3));
        } else {
          resolve(compressed);
        }
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = {
  name: "", description: "", photoUrl: "",
  noOverlap: false, maxGuests: 4, pricePerNight: "",
};

// ─── Property card ────────────────────────────────────────────────────────────
function PropertyCard({ property, onEdit, onDelete, onView }) {
  const [delConfirm, setDelConfirm] = useState(false);

  return (
    <div
      className="card"
      style={{
        overflow: "hidden", transition: "transform 0.2s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      {/* Photo */}
      <div
        onClick={() => onView(property)}
        style={{
          height: 160, background: "var(--bg-secondary)",
          backgroundImage: property.photoUrl ? `url(${property.photoUrl})` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: property.photoUrl ? 0 : 48,
          position: "relative",
        }}
      >
        {!property.photoUrl && "🏠"}
        {/* Overlap badge */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: property.noOverlap
            ? "rgba(255,107,107,0.9)" : "rgba(81,207,102,0.9)",
          color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700,
          padding: "3px 8px", letterSpacing: "0.04em",
        }}>
          {property.noOverlap ? "🔒 NO OVERLAP" : "✅ OVERLAP OK"}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 16, marginBottom: 2 }}>{property.name}</h3>
            {property.description && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                {property.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
          {property.pricePerNight > 0 && (
            <div>
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Price/Night</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-gold)" }}>
                PKR {Number(property.pricePerNight).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Max Guests</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>👥 {property.maxGuests}</p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => onView(property)}
            style={{ flex: 1, fontSize: 12, padding: "7px" }}
          >
            📊 Dashboard
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => onEdit(property)}
            style={{ fontSize: 12, padding: "7px 12px" }}
          >
            ✏️
          </button>
          {delConfirm ? (
            <>
              <button className="btn btn-danger" onClick={() => onDelete(property.name)}
                style={{ fontSize: 12, padding: "7px 10px" }}>Yes</button>
              <button className="btn btn-ghost" onClick={() => setDelConfirm(false)}
                style={{ fontSize: 12, padding: "7px 10px" }}>No</button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setDelConfirm(true)}
              style={{ fontSize: 12, padding: "7px 12px", color: "var(--text-muted)" }}>
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Form Modal ────────────────────────────────────────────────────
function PropertyFormModal({ property, onClose, onSaved }) {
  const [form,    setForm]    = useState(property ? { ...property } : { ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const isEdit = !!property;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Property name is required."); return; }
    setLoading(true); setError("");
    try {
      const url    = isEdit
        ? `${BASE_URL}/api/properties/${encodeURIComponent(property.name)}`
        : `${BASE_URL}/api/properties`;
      const method = isEdit ? "PUT" : "POST";

      const res  = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { onSaved(isEdit ? "Property updated!" : "Property added!"); onClose(); }
      else setError(data.message || "Save failed.");
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 200, backdropFilter: "blur(4px)",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 201, width: "min(560px, 95vw)",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.25s ease", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 26px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 18 }}>{isEdit ? "✏️ Edit Property" : "🏠 Add New Property"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label>Property Name *</label>
            <input name="name" value={form.name} onChange={handleChange}
              placeholder="e.g. Sea View Suite" disabled={isEdit} />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input name="description" value={form.description} onChange={handleChange}
              placeholder="Short description of the property" />
          </div>

          <div className="form-group">
            <label>Property Photo</label>
            {/* Upload from device */}
            <label htmlFor="photo-upload" style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg-input)", border: "1px dashed var(--border)",
              borderRadius: "var(--radius-sm)", padding: "12px 14px",
              cursor: "pointer", color: "var(--text-secondary)", fontSize: 13,
              transition: "border-color 0.2s",
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-gold)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <span style={{ fontSize: 20 }}>📷</span>
              <span>Click to upload from device</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                JPG, PNG (auto-compressed)
              </span>
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // Warn if file is very large
                if (file.size > 10 * 1024 * 1024) {
                  setError("Image too large. Please use an image under 10MB.");
                  return;
                }
                try {
                  const compressed = await compressImage(file);
                  setForm((p) => ({ ...p, photoUrl: compressed }));
                  setError(""); // clear any previous error
                } catch (err) {
                  setError("Could not process image. Try a different file (JPG or PNG recommended).");
                }
              }}
            />
            {/* OR paste URL */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>or paste URL</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <input name="photoUrl"
              value={form.photoUrl?.startsWith("data:") ? "" : (form.photoUrl || "")}
              onChange={handleChange}
              placeholder="https://i.imgur.com/yourphoto.jpg" />
            {/* Preview */}
            {form.photoUrl && (
              <div style={{ position: "relative", marginTop: 8 }}>
                <img src={form.photoUrl} alt="preview"
                  style={{ width: "100%", height: 130, objectFit: "cover",
                    borderRadius: 8, border: "1px solid var(--border)" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <button
                  onClick={() => setForm((p) => ({ ...p, photoUrl: "" }))}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)",
                    border: "none", color: "#fff", borderRadius: "50%", width: 24, height: 24,
                    cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center",
                    justifyContent: "center" }}>✕</button>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label>Price Per Night (PKR)</label>
              <input type="number" name="pricePerNight" value={form.pricePerNight}
                onChange={handleChange} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Max Guests</label>
              <input type="number" name="maxGuests" min="1" max="50"
                value={form.maxGuests} onChange={handleChange} />
            </div>
          </div>

          {/* Overlap toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--bg-secondary)", borderRadius: 10,
            padding: "14px 16px", border: "1px solid var(--border)",
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>🔒 Block Overlapping Bookings</p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                {form.noOverlap
                  ? "Enabled — double bookings are prevented for this property"
                  : "Disabled — multiple bookings can share the same dates"}
              </p>
            </div>
            {/* Toggle switch */}
            <div
              onClick={() => setForm((p) => ({ ...p, noOverlap: !p.noOverlap }))}
              style={{
                width: 46, height: 26, borderRadius: 99, cursor: "pointer",
                background: form.noOverlap ? "var(--accent-gold)" : "var(--bg-input)",
                border: "1px solid var(--border)",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}
            >
              <div style={{
                position: "absolute", top: 3,
                left: form.noOverlap ? 22 : 3,
                width: 18, height: 18, borderRadius: "50%",
                background: "#fff", transition: "left 0.2s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>

          {error && <p style={{ color: "var(--accent-rose)", fontSize: 13 }}>❌ {error}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="btn btn-primary" onClick={handleSave}
              disabled={loading} style={{ flex: 1 }}>
              {loading ? "Saving…" : (isEdit ? "💾 Save Changes" : "➕ Add Property")}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main PropertiesManager component ────────────────────────────────────────
export default function PropertiesManager({ onViewDashboard, onToast }) {
  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editProp,   setEditProp]   = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await bizFetch(`/api/properties`);
      const data = await res.json();
      setProperties(data.properties || []);
    } catch { onToast("Could not load properties.", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (name) => {
    try {
      await bizFetch(`/api/properties/${encodeURIComponent(name)}`, { method: "DELETE" });
      onToast(`"${name}" deleted.`, "success");
      load();
    } catch { onToast("Delete failed.", "error"); }
  };

  const handleSaved = (msg) => { onToast(msg, "success"); load(); };

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton card" style={{ height: 280 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Add button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => { setEditProp(null); setFormOpen(true); }}>
          ➕ Add Property
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h3 style={{ marginBottom: 8 }}>No properties yet</h3>
          <p style={{ fontSize: 14, marginBottom: 20 }}>
            Add your first property to get started.
          </p>
          <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
            ➕ Add Your First Property
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 20 }}>
          {properties.map((p) => (
            <PropertyCard
              key={p.name}
              property={p}
              onEdit={(prop) => { setEditProp(prop); setFormOpen(true); }}
              onDelete={handleDelete}
              onView={onViewDashboard}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <PropertyFormModal
          property={editProp}
          onClose={() => { setFormOpen(false); setEditProp(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
