/**
 * InvoiceModal.jsx
 * Generates a professional printable invoice/receipt for a booking.
 * Uses browser print API styled with injected CSS for clean output.
 */
import React, { useState, useEffect, useRef } from "react";

const BASE_URL = process.env.REACT_APP_API_URL || "";
import { bizFetch, bizUrl } from "../utils/bizApi";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-PK", {
    day: "numeric", month: "long", year: "numeric",
  }) : "—";

const fmt = (n) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 0,
  }).format(n || 0);

export default function InvoiceModal({ booking, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef              = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await bizFetch(`/api/bookings/${booking.bookingId}/invoice`);
        const json = await res.json();
        setData(json.booking);
      } catch { setData(booking); }
      finally { setLoading(false); }
    };
    load();
  }, [booking]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice — ${data?.bookingId}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e;
            background: #fff; padding: 40px; font-size: 14px; }
          .invoice { max-width: 700px; margin: 0 auto; }

          /* Header */
          .header { display: flex; justify-content: space-between;
            align-items: flex-start; margin-bottom: 40px; }
          .logo { display: flex; align-items: center; gap: 12px; }
          .logo-icon { width: 48px; height: 48px; border-radius: 12px;
            background: #d4a853; display: flex; align-items: center;
            justify-content: center; font-size: 24px; flex-shrink: 0; }
          .logo-text h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; }
          .logo-text p { font-size: 11px; color: #666; letter-spacing: 0.06em;
            text-transform: uppercase; margin-top: 2px; }
          .invoice-meta { text-align: right; }
          .invoice-meta h2 { font-size: 28px; font-weight: 700;
            color: #d4a853; letter-spacing: -0.02em; }
          .invoice-meta p { font-size: 12px; color: #666; margin-top: 4px; }

          /* Divider */
          .divider { border: none; border-top: 2px solid #f0ede8; margin: 28px 0; }
          .divider-gold { border-top-color: #d4a853; }

          /* Bill to / from */
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
            margin-bottom: 28px; }
          .party h3 { font-size: 10px; font-weight: 700; color: #999;
            letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
          .party p { font-size: 14px; color: #1a1a2e; margin-bottom: 3px; }
          .party .name { font-size: 16px; font-weight: 700; }

          /* Table */
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f8f5ef; padding: 10px 14px; text-align: left;
            font-size: 10px; font-weight: 700; color: #666;
            letter-spacing: 0.08em; text-transform: uppercase; }
          td { padding: 12px 14px; border-bottom: 1px solid #f0ede8;
            font-size: 13px; color: #1a1a2e; }
          tr:last-child td { border-bottom: none; }

          /* Totals */
          .totals { margin-left: auto; width: 280px; }
          .total-row { display: flex; justify-content: space-between;
            padding: 7px 0; font-size: 13px; border-bottom: 1px solid #f0ede8; }
          .total-row:last-child { border-bottom: none; }
          .total-row.grand { font-size: 16px; font-weight: 700;
            color: #d4a853; padding: 12px 0; }
          .total-row.paid { color: #27ae60; }
          .total-row.due  { color: #e74c3c; font-weight: 700; }

          /* Status badge */
          .badge { display: inline-block; padding: 4px 12px; border-radius: 99px;
            font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
            text-transform: uppercase; }
          .badge-upcoming  { background: #e8f8f7; color: #1abc9c; }
          .badge-active    { background: #eafaf1; color: #27ae60; }
          .badge-completed { background: #f5f5f5; color: #95a5a6; }
          .badge-cancelled { background: #fdf0f0; color: #e74c3c; }

          /* Notes */
          .notes { background: #f8f5ef; border-radius: 8px; padding: 14px 16px;
            margin-top: 20px; font-size: 13px; color: #555; }
          .notes strong { color: #1a1a2e; }

          /* Footer */
          .footer { margin-top: 40px; text-align: center; font-size: 11px;
            color: #999; border-top: 1px solid #f0ede8; padding-top: 20px; }

          @media print {
            body { padding: 20px; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <!-- Header -->
          <div class="header">
            <div class="logo">
              <div class="logo-icon">🏠</div>
              <div class="logo-text">
                <h1>StayTrack</h1>
                <p>Booking Manager</p>
              </div>
            </div>
            <div class="invoice-meta">
              <h2>INVOICE</h2>
              <p>#${data?.bookingId}</p>
              <p>Issued: ${fmtDate(new Date().toISOString())}</p>
              <span class="badge badge-${(data?.status || 'upcoming').toLowerCase()}">${data?.status}</span>
            </div>
          </div>

          <hr class="divider divider-gold" />

          <!-- Parties -->
          <div class="parties">
            <div class="party">
              <h3>Bill To</h3>
              <p class="name">${data?.guestName}</p>
              <p>${data?.phone || "—"}</p>
              <p>Guests: ${data?.guests}</p>
            </div>
            <div class="party">
              <h3>Property</h3>
              <p class="name">${data?.property}</p>
              <p>Source: ${data?.source}</p>
              <p>Booking: ${fmtDate(data?.createdAt)}</p>
            </div>
          </div>

          <hr class="divider" />

          <!-- Stay details table -->
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Nights</th>
                <th style="text-align:right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${data?.property}</strong><br/>
                  <span style="font-size:12px;color:#666">
                    ${data?.guests} guest${data?.guests > 1 ? "s" : ""}
                  </span>
                </td>
                <td>${fmtDate(data?.checkIn)}</td>
                <td>${fmtDate(data?.checkOut)}</td>
                <td>${data?.nights} nights</td>
                <td style="text-align:right;font-weight:600">${fmt(data?.totalPrice)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals">
            <div class="total-row">
              <span>Subtotal</span>
              <span>${fmt(data?.totalPrice)}</span>
            </div>
            <div class="total-row paid">
              <span>✓ Advance Paid</span>
              <span>− ${fmt(data?.advancePaid)}</span>
            </div>
            <hr class="divider" style="margin:4px 0" />
            <div class="total-row ${(data?.remaining || 0) > 0 ? 'due' : 'paid'} grand">
              <span>${(data?.remaining || 0) > 0 ? "Balance Due" : "✓ Fully Paid"}</span>
              <span>${fmt(data?.remaining)}</span>
            </div>
          </div>

          ${data?.notes ? `
          <div class="notes">
            <strong>Notes:</strong> ${data.notes}
          </div>` : ""}

          <div class="footer">
            <p>Thank you for your booking! For any queries please contact us directly.</p>
            <p style="margin-top:6px">Generated by StayTrack Booking Manager · ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        zIndex: 300, backdropFilter: "blur(4px)",
      }} />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 301, width: "min(700px, 95vw)",
        maxHeight: "90vh", overflowY: "auto",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "fadeIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "20px 24px",
          borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 style={{ fontSize: 19 }}>🧾 Invoice Preview</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
              {booking.bookingId}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={handlePrint} disabled={loading}>
              🖨️ Print / Save PDF
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none",
              color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>✕</button>
          </div>
        </div>

        {/* Invoice preview inside modal */}
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ animation: "pulse 1s infinite", fontSize: 32 }}>⏳</div>
            <p style={{ marginTop: 12 }}>Loading invoice…</p>
          </div>
        ) : (
          <div ref={printRef} style={{ padding: "28px 32px", background: "#fff", color: "#1a1a2e" }}>
            {/* Logo row */}
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "#d4a853",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏠</div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e" }}>StayTrack</h2>
                  <p style={{ fontSize: 10, color: "#999", letterSpacing: "0.06em",
                    textTransform: "uppercase" }}>Booking Manager</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <h1 style={{ fontSize: 26, fontWeight: 700, color: "#d4a853" }}>INVOICE</h1>
                <p style={{ fontSize: 12, color: "#666" }}>#{data?.bookingId}</p>
                <p style={{ fontSize: 12, color: "#666" }}>Issued: {fmtDate(new Date().toISOString())}</p>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "2px solid #d4a853", marginBottom: 24 }} />

            {/* Guest + Property */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6 }}>Bill To</p>
                <p style={{ fontSize: 16, fontWeight: 700 }}>{data?.guestName}</p>
                <p style={{ fontSize: 13, color: "#555" }}>{data?.phone}</p>
                <p style={{ fontSize: 13, color: "#555" }}>{data?.guests} guest(s)</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6 }}>Property</p>
                <p style={{ fontSize: 16, fontWeight: 700 }}>{data?.property}</p>
                <p style={{ fontSize: 13, color: "#555" }}>Source: {data?.source}</p>
              </div>
            </div>

            {/* Line items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
              <thead>
                <tr style={{ background: "#f8f5ef" }}>
                  {["Description","Check-in","Check-out","Nights","Amount"].map((h) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: h === "Amount" ? "right" : "left",
                      fontSize: 10, fontWeight: 700, color: "#888",
                      textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "12px 12px", fontSize: 13, fontWeight: 600 }}>{data?.property}</td>
                  <td style={{ padding: "12px 12px", fontSize: 13, color: "#555" }}>{fmtDate(data?.checkIn)}</td>
                  <td style={{ padding: "12px 12px", fontSize: 13, color: "#555" }}>{fmtDate(data?.checkOut)}</td>
                  <td style={{ padding: "12px 12px", fontSize: 13, color: "#555" }}>{data?.nights}</td>
                  <td style={{ padding: "12px 12px", fontSize: 14, fontWeight: 700,
                    textAlign: "right", color: "#1a1a2e" }}>{fmt(data?.totalPrice)}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ marginLeft: "auto", width: 260 }}>
              {[
                { label: "Subtotal",      value: fmt(data?.totalPrice),  color: "#1a1a2e" },
                { label: "✓ Advance Paid", value: `- ${fmt(data?.advancePaid)}`, color: "#27ae60" },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
                  padding: "6px 0", borderBottom: "1px solid #f0ede8", fontSize: 13 }}>
                  <span style={{ color: "#555" }}>{r.label}</span>
                  <span style={{ color: r.color, fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0",
                fontSize: 16, fontWeight: 700,
                color: (data?.remaining || 0) > 0 ? "#e74c3c" : "#27ae60" }}>
                <span>{(data?.remaining || 0) > 0 ? "Balance Due" : "✓ Fully Paid"}</span>
                <span>{fmt(data?.remaining)}</span>
              </div>
            </div>

            {data?.notes && (
              <div style={{ background: "#f8f5ef", borderRadius: 8, padding: "12px 14px",
                marginTop: 20, fontSize: 13, color: "#555" }}>
                <strong>Notes:</strong> {data.notes}
              </div>
            )}

            <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#aaa",
              borderTop: "1px solid #f0ede8", paddingTop: 16 }}>
              Thank you for your booking · Generated by StayTrack · {new Date().toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
