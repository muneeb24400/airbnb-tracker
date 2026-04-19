/**
 * ExpenseTracker.jsx
 * Log and track expenses per property.
 * Categories: Cleaning, Maintenance, Utilities, Supplies, Marketing, Other
 * Shows monthly summary and property-wise breakdown.
 */
import React, { useState, useEffect, useMemo } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";

const CATEGORIES = [
  { name: "Cleaning",    icon: "🧹" },
  { name: "Maintenance", icon: "🔧" },
  { name: "Utilities",   icon: "💡" },
  { name: "Supplies",    icon: "🛒" },
  { name: "Marketing",   icon: "📣" },
  { name: "Other",       icon: "📝" },
];

const CAT_ICON = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.icon]));

const fmt = (n, currency = "PKR", rate = 278) => {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((n || 0) / rate);
  }
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(n || 0);
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—";

const EMPTY_FORM = { date: new Date().toISOString().slice(0, 10), property: "", category: "Cleaning", description: "", amount: "" };

export default function ExpenseTracker({ properties, currency, rate }) {
  const [expenses,  setExpenses]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [error,     setError]     = useState("");
  const [delId,     setDelId]     = useState(null);
  const [filterProp, setFilterProp] = useState("All");
  const [filterCat,  setFilterCat]  = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/expenses`);
      const data = await res.json();
      setExpenses(data.expenses || []);
    } catch { setError("Could not load expenses."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Set default property when properties load
  useEffect(() => {
    if (properties.length > 0 && !form.property) {
      setForm((p) => ({ ...p, property: properties[0].name }));
    }
  }, [properties]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async () => {
    if (!form.date || !form.property || !form.amount) {
      setError("Date, property and amount are required."); return;
    }
    setSaving(true); setError("");
    try {
      const res  = await fetch(`${BASE_URL}/api/expenses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { setForm(EMPTY_FORM); load(); }
      else setError(data.message || "Save failed.");
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${BASE_URL}/api/expenses/${id}`, { method: "DELETE" });
      setExpenses((prev) => prev.filter((e) => e.expenseId !== id));
      setDelId(null);
    } catch { setError("Delete failed."); }
  };

  // Filtered expenses
  const filtered = useMemo(() => {
    return expenses
      .filter((e) => filterProp === "All" || e.property === filterProp)
      .filter((e) => filterCat  === "All" || e.category === filterCat)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, filterProp, filterCat]);

  // Summary stats
  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

  // This month expenses
  const thisMonth = new Date();
  const thisMonthTotal = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  }).reduce((s, e) => s + e.amount, 0);

  // By category
  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // By property
  const byProperty = useMemo(() => {
    const map = {};
    expenses.forEach((e) => { map[e.property] = (map[e.property] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

      {/* ── Left: list + filters ── */}
      <div>
        {/* Summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { icon: "💸", label: "Total (filtered)", value: fmt(totalExpenses, currency, rate), color: "rgba(255,107,107,0.12)" },
            { icon: "📅", label: "This Month",       value: fmt(thisMonthTotal, currency, rate), color: "rgba(212,168,83,0.12)" },
            { icon: "📊", label: "Total Entries",    value: expenses.length,                     color: "rgba(167,139,250,0.12)" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: s.color,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <select value={filterProp} onChange={(e) => setFilterProp(e.target.value)}
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--text-primary)", fontSize: 12, padding: "7px 12px",
              fontFamily: "var(--font-body)", cursor: "pointer" }}>
            <option value="All">All Properties</option>
            {properties.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--text-primary)", fontSize: 12, padding: "7px 12px",
              fontFamily: "var(--font-body)", cursor: "pointer" }}>
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        {/* Expenses list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💸</div>
            <p>No expenses logged yet</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {filtered.map((e, i) => (
              <div key={e.expenseId} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.15s",
              }}
                onMouseEnter={(el) => el.currentTarget.style.background = "var(--bg-card-hover)"}
                onMouseLeave={(el) => el.currentTarget.style.background = "transparent"}
              >
                {/* Category icon */}
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--bg-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0, border: "1px solid var(--border)" }}>
                  {CAT_ICON[e.category] || "📝"}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{e.description || e.category}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-secondary)",
                      padding: "1px 6px", borderRadius: 4 }}>{e.category}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>
                    🏠 {e.property} · 📅 {fmtDate(e.date)}
                  </p>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-rose)" }}>
                    {fmt(e.amount, currency, rate)}
                  </p>
                </div>

                {/* Delete */}
                {delId === e.expenseId ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-danger" onClick={() => handleDelete(e.expenseId)}
                      style={{ padding: "4px 8px", fontSize: 11 }}>Yes</button>
                    <button className="btn btn-ghost" onClick={() => setDelId(null)}
                      style={{ padding: "4px 8px", fontSize: 11 }}>No</button>
                  </div>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setDelId(e.expenseId)}
                    style={{ padding: "4px 10px", fontSize: 12, color: "var(--text-muted)" }}>🗑️</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: add form + summary ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Add expense form */}
        <div className="card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>➕ Log Expense</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="form-group">
              <label>Date</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Property</label>
              <select name="property" value={form.property} onChange={handleChange}>
                {properties.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange}>
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input name="description" value={form.description} onChange={handleChange}
                placeholder="e.g. Monthly cleaning service" />
            </div>
            <div className="form-group">
              <label>Amount (PKR)</label>
              <input type="number" name="amount" value={form.amount}
                onChange={handleChange} placeholder="0" />
            </div>
            {error && <p style={{ color: "var(--accent-rose)", fontSize: 12 }}>❌ {error}</p>}
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "💾 Log Expense"}
            </button>
          </div>
        </div>

        {/* By category breakdown */}
        {byCategory.length > 0 && (
          <div className="card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, marginBottom: 14 }}>📊 By Category</h3>
            {byCategory.map(([cat, amt]) => {
              const pct = Math.round((amt / totalExpenses) * 100);
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{CAT_ICON[cat]} {cat}</span>
                    <span style={{ fontSize: 12, color: "var(--accent-rose)", fontWeight: 600 }}>
                      {fmt(amt, currency, rate)}
                    </span>
                  </div>
                  <div style={{ background: "var(--bg-input)", borderRadius: 99, height: 4 }}>
                    <div style={{ background: "var(--accent-rose)", borderRadius: 99,
                      height: 4, width: `${pct}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* By property breakdown */}
        {byProperty.length > 0 && (
          <div className="card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: 14, marginBottom: 14 }}>🏠 By Property</h3>
            {byProperty.map(([prop, amt]) => (
              <div key={prop} style={{ display: "flex", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{prop}</span>
                <span style={{ color: "var(--accent-rose)", fontWeight: 600 }}>
                  {fmt(amt, currency, rate)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
