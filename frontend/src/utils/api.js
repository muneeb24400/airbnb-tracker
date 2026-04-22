/**
 * api.js - Centralised API helper functions
 * All calls include ?businessId= to scope data to the active business.
 */

const BASE_URL = process.env.REACT_APP_API_URL || "";

// Active business is stored in sessionStorage after selection
function getBizId() {
  return sessionStorage.getItem("st_businessId") || "";
}

function bizParam(extra = "") {
  const id = getBizId();
  const q  = id ? `businessId=${encodeURIComponent(id)}` : "";
  return q ? `?${q}${extra}` : extra ? `?${extra.replace(/^&/, "")}` : "";
}

export async function fetchBookings() {
  const res = await fetch(`${BASE_URL}/api/bookings${bizParam()}`);
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

export async function addBooking(data) {
  const res = await fetch(`${BASE_URL}/api/bookings${bizParam()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, businessId: getBizId() }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to add booking"); }
  return res.json();
}

export async function deleteBooking(id) {
  const res = await fetch(`${BASE_URL}/api/bookings/${id}${bizParam()}`, { method: "DELETE" });
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
