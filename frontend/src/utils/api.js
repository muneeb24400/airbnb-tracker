/**
 * api.js - Core API calls used by App.jsx
 * Uses bizFetch to auto-inject businessId on every request.
 */
import { bizFetch, getBizId } from "./bizApi";

const BASE_URL = process.env.REACT_APP_API_URL || "";

export async function fetchBookings() {
  const res = await bizFetch("/api/bookings");
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

export async function addBooking(data) {
  const res = await bizFetch("/api/bookings", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ...data, businessId: getBizId() }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to add booking"); }
  return res.json();
}

export async function deleteBooking(id) {
  const res = await bizFetch(`/api/bookings/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete booking");
  return res.json();
}

export function exportToCSV(bookings) {
  if (!bookings.length) return;
  const headers = ["Booking ID","Guest Name","Phone","Check-in","Check-out","Nights","Guests","Property","Total Price","Advance Paid","Remaining","Source","Status","Notes"];
  const rows    = bookings.map((b) => [b.bookingId, b.guestName, b.phone, b.checkIn, b.checkOut, b.nights, b.guests, b.property, b.totalPrice, b.advancePaid, b.remaining, b.source, b.status, `"${(b.notes||"").replace(/"/g,'""')}"`]);
  const csv     = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob    = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement("a");
  link.href     = url;
  link.download = `bookings_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
