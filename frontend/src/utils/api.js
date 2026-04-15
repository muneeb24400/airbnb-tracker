/**
 * api.js - Centralised API helper functions
 * All backend calls go through here for easy maintenance.
 */

const BASE_URL = process.env.REACT_APP_API_URL || "";

// ─── Fetch all bookings ───────────────────────────────────────────────────────
export async function fetchBookings() {
  const res = await fetch(`${BASE_URL}/api/bookings`);
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

// ─── Add a new booking ────────────────────────────────────────────────────────
export async function addBooking(bookingData) {
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to add booking");
  }
  return res.json();
}

// ─── Delete a booking ────────────────────────────────────────────────────────
export async function deleteBooking(bookingId) {
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete booking");
  return res.json();
}

// ─── Export bookings as CSV ───────────────────────────────────────────────────
export function exportToCSV(bookings) {
  if (!bookings.length) return;

  const headers = [
    "Booking ID", "Guest Name", "Phone", "Check-in", "Check-out",
    "Nights", "Guests", "Property", "Total Price", "Advance Paid",
    "Remaining", "Source", "Status", "Notes",
  ];

  const rows = bookings.map((b) => [
    b.bookingId, b.guestName, b.phone, b.checkIn, b.checkOut,
    b.nights, b.guests, b.property, b.totalPrice, b.advancePaid,
    b.remaining, b.source, b.status, `"${(b.notes || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `bookings_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
