/**
 * Login.jsx
 * Simple password-protected login screen.
 * Password is set via APP_PASSWORD in backend .env
 */
import React, { useState } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [shake,    setShake]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.success) {
        // Store token in sessionStorage (cleared when browser tab closes)
        sessionStorage.setItem("st_token", data.token);
        onLogin(data.token);
      } else {
        setError("Incorrect password. Please try again.");
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setPassword("");
      }
    } catch {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
            background: "linear-gradient(135deg, var(--accent-gold), #b8922e)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
          }}>🏠</div>
          <h1 style={{ fontSize: 28, fontFamily: "var(--font-display)", marginBottom: 6 }}>
            StayTrack
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Sign in to manage your bookings
          </p>
        </div>

        {/* Card */}
        <div
          className="card"
          style={{
            padding: "36px 32px",
            animation: shake ? "shakeX 0.5s ease" : "fadeIn 0.4s ease",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoFocus
                style={{
                  fontSize: 16,
                  borderColor: error ? "var(--accent-rose)" : undefined,
                }}
              />
              {error && (
                <span style={{ color: "var(--accent-rose)", fontSize: 12, marginTop: 4 }}>
                  ❌ {error}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !password}
              style={{ width: "100%", padding: "13px", fontSize: 15 }}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 20 }}>
          Default password is set in your backend <code style={{ color: "var(--accent-gold)" }}>.env</code> file
          <br />under <code style={{ color: "var(--accent-gold)" }}>APP_PASSWORD</code>
        </p>
      </div>

      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-10px); }
          40%       { transform: translateX(10px); }
          60%       { transform: translateX(-8px); }
          80%       { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
