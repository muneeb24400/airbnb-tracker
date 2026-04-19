/**
 * App.jsx - Root component
 * New in this update:
 * - Calendar view tab with property + source filters
 * - Device photo upload in PropertiesManager
 * - Enhanced remaining payment pill + invoice button in BookingsList
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
import CalendarView       from "./components/CalendarView";
import { Toast, useToast } from "./components/Toast";
import { fetchBookings, addBooking, deleteBooking } from "./utils/api";
import "./App.css";

const BASE_URL = process.env.REACT_APP_API_URL || "";

export default function App() {
  const [bookings,       setBookings]       = useState([]);
  const [properties,     setProperties]     = useState([]);
  const [activeTab,      setActiveTab]      = useState("dashboard");
  const [loading,        setLoading]        = useState(false);
  const [fetchLoading,   setFetchLoading]   = useState(true);
  const [deleteLoading,  setDeleteLoading]  = useState(false);
  const [editBooking,    setEditBooking]    = useState(null);
  const [invoiceBooking, setInvoiceBooking] = useState(null);
  const [viewProperty,   setViewProperty]   = useState(null);
  const [isLoggedIn,     setIsLoggedIn]     = useState(false);
  const { toasts, addToast, removeToast }   = useToast();

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

  const handleEditSaved = async (msg) => { addToast(msg, "success"); await loadBookings(); };
  const handleLogout    = () => { sessionStorage.removeItem("st_token"); setIsLoggedIn(false); setBookings([]); };

  const upcomingCount = bookings.filter((b) => {
    const diff = (new Date(b.checkIn) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3 && b.status === "Upcoming";
  }).length;

  const pendingCount = bookings.filter((b) => (b.remaining || 0) > 0 && b.status !== "Cancelled").length;

  const TABS = [
    { key: "dashboard",  label: "Dashboard",    icon: "📊" },
    { key: "calendar",   label: "Calendar",     icon: "📅" },
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

      {editBooking    && <EditBookingModal booking={editBooking}
        onClose={() => setEditBooking(null)} onSaved={handleEditSaved} />}
      {invoiceBooking && <InvoiceModal booking={invoiceBooking}
        onClose={() => setInvoiceBooking(null)} />}
      {viewProperty   && <PropertyDashboard property={viewProperty}
        allBookings={bookings} onClose={() => setViewProperty(null)}
        onEdit={() => { setViewProperty(null); setActiveTab("properties"); }} />}

      {/* ── Header ── */}
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
        <div className="container" style={{ display: "flex", alignItems: "center",
          padding: "0 20px", height: 64, gap: 8 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto", flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9,
              background: "linear-gradient(135deg, var(--accent-gold), #b8922e)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🏠</div>
            <div>
              <h1 style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 600 }}>StayTrack</h1>
              <p style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em",
                textTransform: "uppercase", marginTop: -1 }}>Booking Manager</p>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="btn" style={{
                padding: "6px 11px", fontSize: 12,
                background: activeTab === tab.key ? "var(--accent-gold-dim)" : "transparent",
                border: activeTab === tab.key ? "1px solid var(--border-accent)" : "1px solid transparent",
                color: activeTab === tab.key ? "var(--accent-gold)" : "var(--text-secondary)",
                fontWeight: activeTab === tab.key ? 600 : 400,
              }}>
                {tab.icon} {tab.label}
                {tab.key === "dashboard" && upcomingCount > 0 && (
                  <span style={{ marginLeft: 4, background: "var(--accent-rose)", color: "#fff",
                    borderRadius: 99, fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>
                    {upcomingCount}
                  </span>
                )}
                {tab.key === "finance" && pendingCount > 0 && (
                  <span style={{ marginLeft: 4, background: "var(--accent-gold)", color: "#0f0f1a",
                    borderRadius: 99, fontSize: 9, padding: "1px 5px", fontWeight: 700 }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button className="btn btn-ghost" onClick={loadBookings} disabled={fetchLoading}
            style={{ padding: "6px 10px", fontSize: 13, flexShrink: 0 }}>
            {fetchLoading ? <span style={{ animation: "pulse 1s infinite" }}>⏳</span> : "🔄"}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}
            style={{ padding: "6px 10px", fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}
            title="Logout">🔓</button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="container" style={{ padding: "28px 24px" }}>

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ marginBottom: 22 }}>
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

        {/* Calendar */}
        {activeTab === "calendar" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Calendar</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Visual overview of all bookings — filter by property or source
              </p>
            </div>
            {fetchLoading
              ? <div className="skeleton card" style={{ height: 500 }} />
              : <CalendarView bookings={bookings} onInvoice={(b) => setInvoiceBooking(b)} />}
          </div>
        )}

        {/* Analytics */}
        {activeTab === "analytics" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Analytics</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Revenue, occupancy, and booking trends</p>
            </div>
            {fetchLoading ? <div className="skeleton card" style={{ height: 400 }} />
              : <Analytics bookings={bookings} />}
          </div>
        )}

        {/* Finance */}
        {activeTab === "finance" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Finance</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Payment reminders, expense tracking, and multi-currency support
              </p>
            </div>
            <Finance bookings={bookings} properties={properties} />
          </div>
        )}

        {/* Properties */}
        {activeTab === "properties" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Properties</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Manage properties — upload photos, set pricing, configure overlap rules
              </p>
            </div>
            <PropertiesManager
              onViewDashboard={(p) => setViewProperty(p)}
              onToast={(msg, type) => addToast(msg, type)}
            />
          </div>
        )}

        {/* Activity Log */}
        {activeTab === "activity" && (
          <div>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Activity Log</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Full audit trail of every action</p>
            </div>
            <ActivityLog />
          </div>
        )}

        {/* Add Booking */}
        {activeTab === "add" && (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 26, marginBottom: 4 }}>Add New Booking</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Saved directly to your Google Sheet.</p>
            </div>
            <BookingForm onSubmit={handleAddBooking} loading={loading}
              existingBookings={bookings} dynamicProperties={properties} />
          </div>
        )}
      </main>

      <footer style={{ padding: "18px 24px", textAlign: "center", color: "var(--text-muted)",
        fontSize: 12, borderTop: "1px solid var(--border)", marginTop: 40 }}>
        StayTrack — Built for Airbnb hosts ·{" "}
        <span style={{ color: "var(--accent-gold-light)" }}>Synced to Google Sheets</span>
      </footer>
    </div>
  );
}
