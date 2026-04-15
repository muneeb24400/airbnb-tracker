/**
 * App.jsx - Root component
 * Manages global state: bookings data, active tab, loading states, toasts.
 */
import React, { useState, useEffect, useCallback } from "react";
import BookingForm from "./components/BookingForm";
import BookingsList from "./components/BookingsList";
import StatsCards from "./components/StatsCards";
import { Toast, useToast } from "./components/Toast";
import { fetchBookings, addBooking, deleteBooking } from "./utils/api";
import "./App.css";

export default function App() {
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'add'
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // ─── Load bookings on mount ─────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    setFetchLoading(true);
    try {
      const { bookings: data } = await fetchBookings();
      setBookings(data || []);
    } catch (err) {
      addToast("Could not load bookings. Is the backend running?", "error");
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  // ─── Add booking ────────────────────────────────────────────────────────────
  const handleAddBooking = async (formData, resetForm) => {
    setLoading(true);
    try {
      const result = await addBooking(formData);
      addToast(`Booking ${result.bookingId} added successfully! 🎉`, "success");
      resetForm();
      await loadBookings(); // Refresh list
      setActiveTab("dashboard"); // Switch to list view
    } catch (err) {
      addToast(err.message || "Failed to add booking.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── Delete booking ─────────────────────────────────────────────────────────
  const handleDeleteBooking = async (bookingId) => {
    setDeleteLoading(true);
    try {
      await deleteBooking(bookingId);
      addToast("Booking deleted.", "success");
      setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
    } catch (err) {
      addToast("Failed to delete booking.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Upcoming check-ins count for badge ────────────────────────────────────
  const upcomingCount = bookings.filter((b) => {
    const today = new Date();
    const ci = new Date(b.checkIn);
    const diff = (ci - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3 && b.status !== "Completed";
  }).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* ── Header ── */}
      <header
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            height: 64,
            gap: 24,
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                background: "linear-gradient(135deg, var(--accent-gold), #b8922e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🏠
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.01em" }}>
                StayTrack
              </h1>
              <p style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: -2 }}>
                Booking Manager
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 4 }}>
            {[
              { key: "dashboard", label: "Dashboard", icon: "📊" },
              { key: "add", label: "New Booking", icon: "➕" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="btn"
                style={{
                  padding: "7px 16px",
                  fontSize: 13,
                  background: activeTab === tab.key ? "var(--accent-gold-dim)" : "transparent",
                  border: activeTab === tab.key ? "1px solid var(--border-accent)" : "1px solid transparent",
                  color: activeTab === tab.key ? "var(--accent-gold)" : "var(--text-secondary)",
                  fontWeight: activeTab === tab.key ? 600 : 400,
                }}
              >
                {tab.icon} {tab.label}
                {tab.key === "dashboard" && upcomingCount > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: "var(--accent-rose)",
                      color: "#fff",
                      borderRadius: "99px",
                      fontSize: 10,
                      padding: "1px 6px",
                      fontWeight: 700,
                    }}
                  >
                    {upcomingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Refresh */}
          <button
            className="btn btn-ghost"
            onClick={loadBookings}
            disabled={fetchLoading}
            style={{ padding: "7px 12px", fontSize: 13 }}
            title="Refresh bookings"
          >
            {fetchLoading ? (
              <span style={{ animation: "pulse 1s infinite" }}>⏳</span>
            ) : (
              "🔄"
            )}
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="container" style={{ padding: "32px 24px" }}>
        {activeTab === "dashboard" && (
          <div>
            {/* Page title */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Overview</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>

            {/* Stats */}
            {fetchLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton card" style={{ height: 96 }} />
                ))}
              </div>
            ) : (
              <StatsCards bookings={bookings} />
            )}

            {/* Bookings List */}
            {fetchLoading ? (
              <div className="skeleton card" style={{ height: 300 }} />
            ) : (
              <BookingsList
                bookings={bookings}
                onDelete={handleDeleteBooking}
                deleteLoading={deleteLoading}
              />
            )}
          </div>
        )}

        {activeTab === "add" && (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Add New Booking</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                This will be saved directly to your Google Sheet.
              </p>
            </div>
            <BookingForm
              onSubmit={handleAddBooking}
              loading={loading}
              existingBookings={bookings}
            />
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "20px 24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 12,
          borderTop: "1px solid var(--border)",
          marginTop: 40,
        }}
      >
        StayTrack — Built for Airbnb hosts managing offline bookings ·{" "}
        <span style={{ color: "var(--accent-gold-light)" }}>Synced to Google Sheets</span>
      </footer>
    </div>
  );
}
