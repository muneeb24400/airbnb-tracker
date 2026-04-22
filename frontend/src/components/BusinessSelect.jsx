/**
 * BusinessSelect.jsx
 * Shown after login, before entering the main app.
 * Users can:
 * - Select a business they already belong to
 * - Create a new business
 * - Join an existing business with a code
 * "Allied Apartments" is auto-created for all existing data.
 */
import React, { useState, useEffect } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";

export default function BusinessSelect({ username, onSelect }) {
  const [businesses,  setBusinesses]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [mode,        setMode]        = useState("select"); // "select" | "create" | "join"
  const [creating,    setCreating]    = useState(false);
  const [joining,     setJoining]     = useState(false);
  const [newBizName,  setNewBizName]  = useState("");
  const [joinCode,    setJoinCode]    = useState("");
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");
  const [showCode,    setShowCode]    = useState(null); // businessId whose code to show
  const [codeData,    setCodeData]    = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/api/businesses/mine?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch { setError("Could not load businesses. Check your connection."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Create new business ─────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newBizName.trim()) { setError("Please enter a business name."); return; }
    setCreating(true); setError("");
    try {
      const res  = await fetch(`${BASE_URL}/api/businesses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBizName.trim(), username }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`"${newBizName}" created! Join code: ${data.joinCode}`);
        setNewBizName("");
        setMode("select");
        await load();
      } else { setError(data.message || "Failed to create business."); }
    } catch { setError("Network error. Please try again."); }
    finally { setCreating(false); }
  };

  // ── Join with code ──────────────────────────────────────────────────────────
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) { setError("Please enter a join code."); return; }
    setJoining(true); setError("");
    try {
      const res  = await fetch(`${BASE_URL}/api/businesses/join`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: joinCode.trim(), username }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        setJoinCode("");
        setMode("select");
        await load();
      } else { setError(data.message || "Could not join business."); }
    } catch { setError("Network error. Please try again."); }
    finally { setJoining(false); }
  };

  // ── Show join code for a business ───────────────────────────────────────────
  const handleShowCode = async (bizId) => {
    if (showCode === bizId) { setShowCode(null); setCodeData(null); return; }
    try {
      const res  = await fetch(`${BASE_URL}/api/businesses/${bizId}/code`);
      const data = await res.json();
      if (data.success) { setCodeData(data); setShowCode(bizId); }
    } catch {}
  };

  // ── Business colour map ─────────────────────────────────────────────────────
  const BIZ_COLORS = [
    "linear-gradient(135deg, #d4a853, #b8922e)",
    "linear-gradient(135deg, #4ecdc4, #2ba8a0)",
    "linear-gradient(135deg, #a78bfa, #7c3aed)",
    "linear-gradient(135deg, #f97316, #c2410c)",
    "linear-gradient(135deg, #51cf66, #2f9e44)",
    "linear-gradient(135deg, #ff6b6b, #c92a2a)",
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-primary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, flexDirection: "column",
    }}>
      {/* Glow */}
      <div style={{
        position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 680 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: "0 auto 14px",
            background: "linear-gradient(135deg, var(--accent-gold), #b8922e)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>🏠</div>
          <h1 style={{ fontSize: 26, fontFamily: "var(--font-display)", marginBottom: 6 }}>
            Welcome back, {username}!
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Select a business to continue or create a new one
          </p>
        </div>

        {/* Mode switcher */}
        {mode !== "select" && (
          <button onClick={() => { setMode("select"); setError(""); setSuccess(""); }}
            style={{ background: "none", border: "none", color: "var(--accent-gold)",
              cursor: "pointer", fontSize: 14, marginBottom: 16, padding: 0,
              display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)" }}>
            ← Back to businesses
          </button>
        )}

        {/* ── SELECT MODE ── */}
        {mode === "select" && (
          <>
            {/* Success toast */}
            {success && (
              <div style={{
                background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)",
                borderRadius: 10, padding: "12px 16px", color: "var(--accent-green)",
                fontSize: 13, marginBottom: 16,
              }}>✅ {success}</div>
            )}

            {/* Loading */}
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
                ))}
              </div>
            ) : businesses.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                <p>You don't belong to any business yet.</p>
                <p style={{ fontSize: 13, marginTop: 6 }}>Create a new one or join with a code below.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                {businesses.map((biz, idx) => (
                  <div key={biz.businessId}
                    className="card"
                    style={{ overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = ""; }}
                  >
                    {/* Colour banner */}
                    <div style={{
                      height: 80, background: BIZ_COLORS[idx % BIZ_COLORS.length],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 36, position: "relative",
                    }}>
                      🏢
                      {/* Role badge */}
                      <div style={{
                        position: "absolute", top: 10, right: 10,
                        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
                        borderRadius: 99, padding: "3px 10px", fontSize: 10,
                        fontWeight: 700, color: "#fff", letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}>
                        {biz.userRole === "admin" ? "👑 Admin" : "👤 Member"}
                      </div>
                    </div>

                    <div style={{ padding: "16px 18px" }}>
                      <h3 style={{ fontSize: 17, marginBottom: 4, fontFamily: "var(--font-display)" }}>
                        {biz.name}
                      </h3>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                        👥 {biz.memberCount} member{biz.memberCount !== 1 ? "s" : ""}
                      </p>

                      {/* Enter button */}
                      <button
                        className="btn btn-primary"
                        onClick={() => onSelect(biz)}
                        style={{ width: "100%", marginBottom: 8 }}
                      >
                        Enter Business →
                      </button>

                      {/* Show join code (admin only) */}
                      {biz.userRole === "admin" && (
                        <>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleShowCode(biz.businessId)}
                            style={{ width: "100%", fontSize: 12 }}
                          >
                            🔑 {showCode === biz.businessId ? "Hide" : "Show"} Join Code
                          </button>
                          {showCode === biz.businessId && codeData && (
                            <div style={{
                              marginTop: 8, background: "var(--bg-secondary)",
                              border: "1px solid var(--border-accent)", borderRadius: 8,
                              padding: "10px 14px", textAlign: "center",
                            }}>
                              <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Share this code to invite members
                              </p>
                              <p style={{
                                fontSize: 22, fontWeight: 700, letterSpacing: "0.15em",
                                color: "var(--accent-gold)", fontFamily: "monospace",
                              }}>
                                {codeData.joinCode}
                              </p>
                              <button
                                onClick={() => navigator.clipboard.writeText(codeData.joinCode)}
                                style={{ background: "none", border: "none", color: "var(--text-muted)",
                                  cursor: "pointer", fontSize: 11, marginTop: 4, fontFamily: "var(--font-body)" }}>
                                📋 Copy
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={() => { setMode("create"); setError(""); setSuccess(""); }}
                style={{ padding: "14px" }}
              >
                🏢 Create New Business
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { setMode("join"); setError(""); setSuccess(""); }}
                style={{ padding: "14px" }}
              >
                🔑 Join with Code
              </button>
            </div>
          </>
        )}

        {/* ── CREATE MODE ── */}
        {mode === "create" && (
          <div className="card" style={{ padding: "32px 28px" }}>
            <h2 style={{ fontSize: 22, marginBottom: 6, fontFamily: "var(--font-display)" }}>
              🏢 Create New Business
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
              You'll be the admin. A unique join code will be generated so others can join.
            </p>
            <form onSubmit={handleCreate}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label>Business Name *</label>
                  <input
                    value={newBizName}
                    onChange={(e) => { setNewBizName(e.target.value); setError(""); }}
                    placeholder="e.g. Blue Ocean Apartments, City Stays..."
                    autoFocus style={{ fontSize: 15 }}
                  />
                </div>
                {error && (
                  <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
                    borderRadius: 8, padding: "10px 14px", color: "var(--accent-rose)", fontSize: 13 }}>
                    ❌ {error}
                  </div>
                )}
                <button type="submit" className="btn btn-primary"
                  disabled={creating} style={{ padding: "13px", fontSize: 15 }}>
                  {creating ? "Creating…" : "🏢 Create Business"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── JOIN MODE ── */}
        {mode === "join" && (
          <div className="card" style={{ padding: "32px 28px" }}>
            <h2 style={{ fontSize: 22, marginBottom: 6, fontFamily: "var(--font-display)" }}>
              🔑 Join a Business
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
              Ask your business admin for the join code and enter it below.
            </p>
            <form onSubmit={handleJoin}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label>Join Code *</label>
                  <input
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
                    placeholder="e.g. A1B2C3"
                    autoFocus
                    style={{ fontSize: 20, letterSpacing: "0.15em", fontFamily: "monospace",
                      textAlign: "center", textTransform: "uppercase" }}
                    maxLength={10}
                  />
                </div>
                {error && (
                  <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)",
                    borderRadius: 8, padding: "10px 14px", color: "var(--accent-rose)", fontSize: 13 }}>
                    ❌ {error}
                  </div>
                )}
                <button type="submit" className="btn btn-primary"
                  disabled={joining} style={{ padding: "13px", fontSize: 15 }}>
                  {joining ? "Joining…" : "🔑 Join Business"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
