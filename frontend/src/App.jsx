/**
 * App.jsx - Root component
 * Phase 6: Finance tab (Payment Reminders, Expense Tracker, Invoice PDF, Currency)
 */
import React, { useState, useCallback, useEffect } from "react";
import BookingForm        from "./components/BookingForm";
import BookingsList       from "./components/BookingsList";
import StatsCards         from "./components/StatsCards";
import Analytics          from "./components/Analytics";
import ActivityLog        from "./components/ActivityLog";
import EditBookingModal   from "./components/EditBookingModal";
import Login              from "./components/Login";
import PropertiesManager  from "./components/PropertiesManager";
import PropertyDashboard  from "./components/PropertyDashboard";
import Finance            from "./components/Finance";
import InvoiceModal       from "./components/InvoiceModal";
import { Toast, useToast } from "./components/Toast";
import { fetchBookings, addBooking, deleteBooking } from "./utils/api";
import "./App.css";

const BASE_URL = process.env.REACT_APP_API_URL || "";

export default function App() {
  const [bookings,      setBookings]      = useState([]);
  const [properties,    setProperties]    = useState([]);
  const [activeTab,     setActiveTab]     = useState("dashboard");
  const [loading,       setLoading]       = useState(false);
  const [fetchLoading,  setFetchLoading]  = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editBooking,   setEditBooking]   = useState(null);
  const [invoiceBooking, setInvoiceBooking] = useState(null);
  const [viewProperty,  setViewProperty]  = useState(null);
  const [isLoggedIn,    setIsLoggedIn]    = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // ── Restore session ─────────────────────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem("st_token");
    if (token) {
      fetch(`${BASE_URL}/api/auth/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.success) setIsLoggedIn(true); })
        .catch(() => {});
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setFetchLoading(true);
    try {
      const { bookings: data } = await fetchBookings();
      setBookings(data || []);
    } catch { addToast("Could not load bookings.", "error"); }
    finally { setFetchLoading(false); }
  }, []);

  const loadProperties = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/properties`);
      const data = await res.json();
      setProperties(data.properties || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (isLoggedIn) { loadBookings(); loadProperties(); }
  }, [isLoggedIn]);

  const handleAddBooking = async (formData, resetForm) => {
    setLoading(true);
    try {
      const result = await addBooking(formData);
      addToast(`Booking ${result.bookingId} added! 🎉`, "success");
      resetForm(); await loadBookings(); setActiveTab("dashboard");
    } catch (err) { addToast(err.message || "Failed to add booking.", "error"); }
    finally { setLoading(false); }
  };

  const handleDeleteBooking = async (bookingId) => {
    setDeleteLoading(true);
    try {
      await deleteBooking(bookingId);
      addToast("Booking deleted.", "success");
      setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
    } catch { addToast("Failed to delete booking.", "error"); }
    finally { setDeleteLoading(false); }
  };

  const handleEditSaved = async (message) => {
    addToast(message, "success"); await loadBookings();
  };

  const handleLogout = () => {
    sessionStorage.removeItem("st_token");
    setIsLoggedIn(false); setBookings([]);
  };

  const upcomingCount = bookings.filter((b) => {
    const diff = (new Date(b.checkIn) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3 && b.status === "Upcoming";
  }).length;

  const pendingCount = bookings.filter((b) =>
    (b.remaining || 0) > 0 && b.status !== "Cancelled"
  ).length;

  const TABS = [
    { key: "dashboard",  label: "Dashboard",    icon: "📊" },
    { key: "analytics",  label: "Analytics",    icon: "📈" },
    { key: "finance",    label: "Finance",      icon: "💰" },
    { key: "properties", label: "Properties",   icon: "🏠" },
    { key: "activity",   label: "Activity Log", icon: "📜" },
    { key: "add",        label: "New Booking",  icon: "➕" },
  ];

  if (!isLoggedIn) {
    return (
      <>
        <Toast toasts={toasts} removeToast={removeToast} />
        <Login onLogin={() => setIsLoggedIn(true)} />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      {editBooking   && <EditBookingModal booking={editBooking}
        onClose={() => setEditBooking(null)} onSaved={handleEditSaved} />}
      {invoiceBooking && <InvoiceModal booking={invoiceBooking}
        onClose={() => setInvoiceBooking(null)} />}
      {viewProperty  && <PropertyDashboard property={viewProperty}
        allBookings={bookings} onClose={() => setViewProperty(null)}
        onEdit={(p) => { setViewProperty(null); setActiveTab("properties"); }} />}

      {/* Header */}
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
        <div className="container" style={{ display: "flex", alignItems: "center",
          padding: "0 24px", height: 64, gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, var(--accent-gold), #b8922e)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏠</div>
            <div>
              <h1 style={{ fontSize: 17, fontFamily: "var(--font-display)", fontWeight: 600 }}>StayTrack</h1>
              <p style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em",
                textTransform: "uppercase", marginTop: -2 }}>Booking Manager</p>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="btn" style={{
                padding: "7px 12px", fontSize: 12,
                background: activeTab === tab.key ? "var(--accent-gold-dim)" : "transparent",
                border: activeTab === tab.key ? "1px solid var(--border-accent)" : "1px solid transparent",
                color: activeTab === tab.key ? "var(--accent-gold)" : "var(--text-secondary)",
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}>
                {tab.icon} {tab.label}
                {tab.key === "dashboard" && upcomingCount > 0 && (
                  <span style={{ marginLeft: 5, background: "var(--accent-rose)", color: "#fff",
                    borderRadius: 99, fontSize: 10, padding: "1px 5px", fontWeight: 700 }}>
                    {upcomingCount}
                  </span>
                )}
                {tab.key === "finance" && pendingCount > 0 && (
                  <span style={{ marginLeft: 5, background: "var(--accent-gold)", color: "#0f0f1a",
                    borderRadius: 99, fontSize: 10, padding: "1px 5px", fontWeight: 700 }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button className="btn btn-ghost" onClick={loadBookings} disabled={fetchLoading}
            style={{ padding: "7px 10px", fontSize: 13 }}>
            {fetchLoading ? <span style={{ animation: "pulse 1s infinite" }}>⏳</span> : "🔄"}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}
            style={{ padding: "7px 10px", fontSize: 12, color: "var(--text-muted)" }}>
            🔓
          </button>
        </div>
      </header>

      <main className="container" style={{ padding: "32px 24px" }}>

        {activeTab === "dashboard" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Overview</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            {fetchLoading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 28 }}>
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton card" style={{ height: 96 }} />)}
              </div>
            ) : <StatsCards bookings={bookings} />}
            {fetchLoading
              ? <div className="skeleton card" style={{ height: 300 }} />
              : <BookingsList bookings={bookings} onDelete={handleDeleteBooking}
                  deleteLoading={deleteLoading} onEdit={(b) => setEditBooking(b)}
                  onInvoice={(b) => setInvoiceBooking(b)} />}
          </div>
        )}

        {activeTab === "analytics" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Analytics</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Revenue, occupancy, and booking trends</p>
            </div>
            {fetchLoading ? <div className="skeleton card" style={{ height: 400 }} />
              : <Analytics bookings={bookings} />}
          </div>
        )}

        {activeTab === "finance" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Finance</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Payment reminders, expense tracking, and multi-currency support
              </p>
            </div>
            <Finance bookings={bookings} properties={properties} />
          </div>
        )}

        {activeTab === "properties" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Properties</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Manage properties — photos, pricing, overlap rules
              </p>
            </div>
            <PropertiesManager
              onViewDashboard={(p) => setViewProperty(p)}
              onToast={(msg, type) => addToast(msg, type)}
            />
          </div>
        )}

        {activeTab === "activity" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Activity Log</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Full audit trail of every action</p>
            </div>
            <ActivityLog />
          </div>
        )}

        {activeTab === "add" && (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Add New Booking</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Saved directly to your Google Sheet.</p>
            </div>
            <BookingForm onSubmit={handleAddBooking} loading={loading}
              existingBookings={bookings} dynamicProperties={properties} />
          </div>
        )}
      </main>

      <footer style={{ padding: "20px 24px", textAlign: "center", color: "var(--text-muted)",
        fontSize: 12, borderTop: "1px solid var(--border)", marginTop: 40 }}>
        StayTrack — Built for Airbnb hosts ·{" "}
        <span style={{ color: "var(--accent-gold-light)" }}>Synced to Google Sheets</span>
      </footer>
    </div>
  );
}
