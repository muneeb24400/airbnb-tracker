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
  const [currentUser,    setCurrentUser]    = useState("");   // logged-in username
  const [currentRole,    setCurrentRole]    = useState("");   // "admin" | "user"
  const { toasts, addToast, removeToast }   = useToast();

  // ── Restore session ─────────────────────────────────────────────────────────
  useEffect(() => {
    const token    = sessionStorage.getItem("st_token");
    const username = sessionStorage.getItem("st_username");
    const role     = sessionStorage.getItem("st_role");
    if (token) {
      fetch(`${BASE_URL}/api/auth/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setIsLoggedIn(true);
            setCurrentUser(d.username || username || "");
            setCurrentRole(d.role     || role     || "user");
          }
        })
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

  // ─── Mark booking as Completed (with optional payment collection) ────────────
  const handleCompleteBooking = async (bookingId, paymentReceived = 0, booking = {}) => {
    try {
      // Step 1 — update status to Completed
      const statusRes = await fetch(`${BASE_URL}/api/bookings/${bookingId}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "Completed" }),
      });
      if (!statusRes.ok) throw new Error("Status update failed");

      // Step 2 — if payment was entered, update advance paid + remaining via edit
      if (paymentReceived > 0) {
        const newAdvance   = (parseFloat(booking.advancePaid) || 0) + paymentReceived;
        const newRemaining = Math.max(0, (parseFloat(booking.totalPrice) || 0) - newAdvance);
        await fetch(`${BASE_URL}/api/bookings/${bookingId}`, {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            ...booking,
            advancePaid: newAdvance,
            remaining:   newRemaining,
            status:      "Completed",
          }),
        });
        // Update locally with new amounts
        setBookings((prev) => prev.map((b) =>
          b.bookingId === bookingId
            ? { ...b, status: "Completed", advancePaid: newAdvance, remaining: newRemaining }
            : b
        ));
        addToast(
          `Booking completed! PKR ${paymentReceived.toLocaleString()} payment recorded ✅`,
          "success"
        );
      } else {
        // No payment — just update status locally
        setBookings((prev) => prev.map((b) =>
          b.bookingId === bookingId ? { ...b, status: "Completed" } : b
        ));
        addToast("Booking marked as Completed ✅", "success");
      }
    } catch { addToast("Could not complete booking. Please try again.", "error"); }
  };

  const handleEditSaved = async (msg) => { addToast(msg, "success"); await loadBookings(); };
  const handleLogout    = () => {
    sessionStorage.removeItem("st_token");
    sessionStorage.removeItem("st_username");
    sessionStorage.removeItem("st_role");
    setIsLoggedIn(false); setCurrentUser(""); setCurrentRole(""); setBookings([]);
  };

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
        <Login onLogin={(token, username, role) => {
          setIsLoggedIn(true);
          setCurrentUser(username || "");
          setCurrentRole(role     || "user");
        }} />
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

          {/* User info + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "var(--bg-secondary)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "5px 12px",
            }}>
              <span style={{ fontSize: 14 }}>
                {currentRole === "admin" ? "👑" : "👤"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                {currentUser}
              </span>
              {currentRole === "admin" && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                  background: "var(--accent-gold-dim)", color: "var(--accent-gold)",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>Admin</span>
              )}
            </div>
            <button className="btn btn-ghost" onClick={handleLogout}
              style={{ padding: "6px 10px", fontSize: 12, color: "var(--text-muted)" }}
              title="Sign out">
              🔓
            </button>
          </div>
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
                  onInvoice={(b) => setInvoiceBooking(b)}
                  onComplete={handleCompleteBooking} />}
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
