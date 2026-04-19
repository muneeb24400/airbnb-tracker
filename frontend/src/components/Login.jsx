/**
 * Login.jsx
 * Multi-user login screen with Create Account support.
 */
import React, { useState } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";

export default function Login({ onLogin }) {
  const [mode,     setMode]     = useState("login");
  const [form,     setForm]     = useState({ username: "", password: "", confirmPassword: "", adminCode: "" });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [shake,    setShake]    = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);

  const handleChange = (e) => { setForm((p) => ({ ...p, [e.target.name]: e.target.value })); setError(""); };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600); };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { setError("Please enter your username and password."); triggerShake(); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("st_token",    data.token);
        sessionStorage.setItem("st_username", data.username);
        sessionStorage.setItem("st_role",     data.role);
        onLogin(data.token, data.username, data.role);
      } else { setError(data.message || "Login failed."); triggerShake(); }
    } catch { setError("Cannot connect to server."); triggerShake(); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.confirmPassword) { setError("Please fill in all fields."); triggerShake(); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); triggerShake(); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); triggerShake(); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const res  = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password, confirmPassword: form.confirmPassword, adminCode: form.adminCode }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("st_token",    data.token);
        sessionStorage.setItem("st_username", data.username);
        sessionStorage.setItem("st_role",     data.role);
        setSuccess(data.message);
        setTimeout(() => onLogin(data.token, data.username, data.role), 800);
      } else { setError(data.message || "Registration failed."); triggerShake(); }
    } catch { setError("Cannot connect to server."); triggerShake(); }
    finally { setLoading(false); }
  };

  const switchMode = (m) => { setMode(m); setError(""); setSuccess(""); setForm({ username: "", password: "", confirmPassword: "", adminCode: "" }); };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,168,83,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px", background: "linear-gradient(135deg, var(--accent-gold), #b8922e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🏠</div>
          <h1 style={{ fontSize: 28, fontFamily: "var(--font-display)", marginBottom: 6 }}>StayTrack</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {mode === "login" ? "Sign in to manage your bookings" : "Create your StayTrack account"}
          </p>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {[{ key: "login", label: "🔐 Sign In" }, { key: "register", label: "✨ Create Account" }].map((t) => (
            <button key={t.key} onClick={() => switchMode(t.key)} style={{
              flex: 1, padding: "10px", fontSize: 13, fontWeight: 600,
              background: mode === t.key ? "linear-gradient(135deg, var(--accent-gold), #b8922e)" : "transparent",
              border: "none", borderRadius: 9,
              color: mode === t.key ? "#0f0f1a" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.2s", fontFamily: "var(--font-body)",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px 28px", animation: shake ? "shakeX 0.5s ease" : "fadeIn 0.3s ease" }}>

          {/* LOGIN */}
          {mode === "login" && (
            <form onSubmit={handleLogin}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label>Username</label>
                  <input name="username" autoComplete="username" placeholder="Enter your username"
                    value={form.username} onChange={handleChange} autoFocus style={{ fontSize: 15 }} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <div style={{ position: "relative" }}>
                    <input name="password" type={showPass ? "text" : "password"} autoComplete="current-password"
                      placeholder="Enter your password" value={form.password} onChange={handleChange}
                      style={{ fontSize: 15, paddingRight: 42 }} />
                    <button type="button" onClick={() => setShowPass((p) => !p)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, padding: 0 }}>
                      {showPass ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                {error && <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-rose)", fontSize: 13 }}>❌ {error}</div>}
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: "13px", fontSize: 15, marginTop: 4 }}>
                  {loading ? "Signing in…" : "Sign In →"}
                </button>
              </div>
            </form>
          )}

          {/* REGISTER */}
          {mode === "register" && (
            <form onSubmit={handleRegister}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="form-group">
                  <label>Username *</label>
                  <input name="username" autoComplete="username" placeholder="letters, numbers and _ only"
                    value={form.username} onChange={handleChange} autoFocus style={{ fontSize: 15 }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Min 3 chars · no spaces</span>
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <div style={{ position: "relative" }}>
                    <input name="password" type={showPass ? "text" : "password"} autoComplete="new-password"
                      placeholder="At least 6 characters" value={form.password} onChange={handleChange}
                      style={{ fontSize: 15, paddingRight: 42 }} />
                    <button type="button" onClick={() => setShowPass((p) => !p)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, padding: 0 }}>
                      {showPass ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input name="confirmPassword" type={showPass ? "text" : "password"} autoComplete="new-password"
                    placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange}
                    style={{ fontSize: 15, borderColor: error && form.password !== form.confirmPassword ? "var(--accent-rose)" : undefined }} />
                </div>

                {/* Admin code — collapsible */}
                <div>
                  <button type="button" onClick={() => setShowAdminCode((p) => !p)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: 0, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)" }}>
                    {showAdminCode ? "▼" : "▶"} Have an admin code? (optional)
                  </button>
                  {showAdminCode && (
                    <div className="form-group" style={{ marginTop: 8 }}>
                      <input name="adminCode" type="password" placeholder="Enter admin code"
                        value={form.adminCode} onChange={handleChange} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Leave blank for standard user account</span>
                    </div>
                  )}
                </div>

                {error   && <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-rose)", fontSize: 13 }}>❌ {error}</div>}
                {success && <div style={{ background: "rgba(81,207,102,0.1)",  border: "1px solid rgba(81,207,102,0.3)",  borderRadius: 8, padding: "10px 14px", color: "var(--accent-green)", fontSize: 13 }}>✅ {success}</div>}

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: "13px", fontSize: 15, marginTop: 4 }}>
                  {loading ? "Creating account…" : "✨ Create Account"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)" }}>
          {mode === "login" ? (
            <p>👑 The <strong style={{ color: "var(--accent-gold)" }}>first account</strong> created is automatically the admin.</p>
          ) : (
            <>
              <p>👑 First account = admin automatically.</p>
              <p style={{ marginTop: 4 }}>🔒 Admin code is set via <code style={{ color: "var(--accent-gold)" }}>ADMIN_CODE</code> in your backend .env</p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shakeX {
          0%,100% { transform:translateX(0); }
          20%     { transform:translateX(-10px); }
          40%     { transform:translateX(10px); }
          60%     { transform:translateX(-8px); }
          80%     { transform:translateX(8px); }
        }
      `}</style>
    </div>
  );
}
