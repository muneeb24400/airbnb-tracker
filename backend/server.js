/**
 * server.js - Airbnb Tracker Backend
 * Phase 1 additions: Login auth, Edit booking, Status update,
 *                    Cancellation tracking, Activity log
 */

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { google } = require("googleapis");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── Google Sheets Auth ───────────────────────────────────────────────────────
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id:     process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key:    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email:   process.env.GOOGLE_CLIENT_EMAIL,
      client_id:      process.env.GOOGLE_CLIENT_ID,
      token_uri:      "https://oauth2.googleapis.com/token",
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID  = process.env.SPREADSHEET_ID;
const SHEET_NAME      = process.env.SHEET_NAME      || "Bookings";
const ACTIVITY_SHEET  = process.env.ACTIVITY_SHEET  || "ActivityLog";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateBookingId() {
  return `BK-${Date.now().toString(36).toUpperCase()}`;
}

function calculateNights(checkIn, checkOut) {
  const diff = Math.abs(new Date(checkOut) - new Date(checkIn));
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function deriveStatus(checkIn, checkOut) {
  const today = new Date();
  const ci    = new Date(checkIn);
  const co    = new Date(checkOut);
  if (today >= ci && today <= co) return "Active";
  if (today > co)                 return "Completed";
  return "Upcoming";
}

// ─── Ensure header row on Bookings sheet ─────────────────────────────────────
async function ensureBookingHeaders(sheets) {
  const headers = [
    "Booking ID","Guest Name","Phone Number","Check-in Date","Check-out Date",
    "Nights","Number of Guests","Property / Room","Total Price","Advance Paid",
    "Remaining Amount","Booking Source","Notes","Status","Created At",
    "Cancel Reason","Refund Issued",
  ];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:Q1`,
  });
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

// ─── Ensure header row on ActivityLog sheet ───────────────────────────────────
async function ensureActivityHeaders(sheets) {
  const headers = ["Timestamp","Action","Booking ID","Guest Name","Details","User"];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ACTIVITY_SHEET}!A1:F1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${ACTIVITY_SHEET}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
  } catch {
    // Sheet might not exist yet — will be created on first write
  }
}

// ─── Log activity to ActivityLog sheet ───────────────────────────────────────
async function logActivity(sheets, { action, bookingId, guestName, details }) {
  try {
    await ensureActivityHeaders(sheets);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ACTIVITY_SHEET}!A:F`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          new Date().toISOString(),
          action,
          bookingId || "",
          guestName || "",
          details   || "",
          "Host",
        ]],
      },
    });
  } catch (err) {
    console.warn("Activity log failed (non-critical):", err.message);
  }
}

// ─── Find row index of a booking by ID ───────────────────────────────────────
async function findRowIndex(sheets, bookingId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const rows = res.data.values || [];
  return rows.findIndex((r) => r[0] === bookingId);
}

// ─── Get numeric sheet ID for batchUpdate ────────────────────────────────────
async function getSheetId(sheets) {
  const info  = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = info.data.sheets.find((s) => s.properties.title === SHEET_NAME);
  return sheet?.properties?.sheetId ?? 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/login
 * Body: { password }
 * Returns a simple token (the hashed password match).
 * For simplicity we use a plaintext env password — good enough for solo use.
 */
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  const APP_PASSWORD = process.env.APP_PASSWORD || "staytrack2024";

  if (password === APP_PASSWORD) {
    // Return a simple session token (timestamp-based, stored client-side)
    const token = Buffer.from(`auth:${Date.now()}`).toString("base64");
    return res.json({ success: true, token, message: "Login successful" });
  }
  return res.status(401).json({ success: false, message: "Incorrect password" });
});

/** POST /api/auth/verify — check if a token is still valid (always true for simplicity) */
app.post("/api/auth/verify", (req, res) => {
  const { token } = req.body;
  if (token) return res.json({ success: true });
  return res.status(401).json({ success: false });
});

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/** POST /api/bookings — Add new booking */
app.post("/api/bookings", async (req, res) => {
  try {
    const { guestName, phone, checkIn, checkOut, guests, property,
            totalPrice, advancePaid, source, notes } = req.body;

    if (!guestName || !checkIn || !checkOut || !property) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const sheets    = getSheetsClient();
    await ensureBookingHeaders(sheets);

    const remaining = (parseFloat(totalPrice) || 0) - (parseFloat(advancePaid) || 0);
    const nights    = calculateNights(checkIn, checkOut);
    const bookingId = generateBookingId();
    const status    = deriveStatus(checkIn, checkOut);

    const row = [
      bookingId, guestName, phone || "", checkIn, checkOut, nights,
      guests || 1, property, parseFloat(totalPrice) || 0,
      parseFloat(advancePaid) || 0, remaining, source || "Other",
      notes || "", status, new Date().toISOString(), "", "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    await logActivity(sheets, {
      action: "BOOKING_ADDED",
      bookingId,
      guestName,
      details: `${property} | ${checkIn} → ${checkOut} | PKR ${totalPrice}`,
    });

    res.json({ success: true, message: "Booking added!", bookingId,
      data: { bookingId, guestName, checkIn, checkOut, nights, remaining } });
  } catch (error) {
    console.error("Error adding booking:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/bookings — Fetch all bookings */
app.get("/api/bookings", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Q`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, bookings: [] });

    const bookings = rows.slice(1).map((row) => ({
      bookingId:    row[0]  || "",
      guestName:    row[1]  || "",
      phone:        row[2]  || "",
      checkIn:      row[3]  || "",
      checkOut:     row[4]  || "",
      nights:       row[5]  || 0,
      guests:       row[6]  || 1,
      property:     row[7]  || "",
      totalPrice:   parseFloat(row[8])  || 0,
      advancePaid:  parseFloat(row[9])  || 0,
      remaining:    parseFloat(row[10]) || 0,
      source:       row[11] || "",
      notes:        row[12] || "",
      status:       row[13] || "",
      createdAt:    row[14] || "",
      cancelReason: row[15] || "",
      refundIssued: row[16] || "",
    }));

    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PUT /api/bookings/:id — Edit an existing booking */
app.put("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { guestName, phone, checkIn, checkOut, guests, property,
            totalPrice, advancePaid, source, notes, status } = req.body;

    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, id);

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const remaining  = (parseFloat(totalPrice) || 0) - (parseFloat(advancePaid) || 0);
    const nights     = calculateNights(checkIn, checkOut);
    const newStatus  = status || deriveStatus(checkIn, checkOut);

    // rowIndex is 0-based; row 0 = header, so sheet row = rowIndex + 1
    // Columns A–M (1–13) + N (status) + O (createdAt stays) → update A:N
    const range = `${SHEET_NAME}!A${rowIndex + 1}:N${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          id, guestName, phone || "", checkIn, checkOut, nights,
          guests || 1, property, parseFloat(totalPrice) || 0,
          parseFloat(advancePaid) || 0, remaining, source || "Other",
          notes || "", newStatus,
        ]],
      },
    });

    await logActivity(sheets, {
      action: "BOOKING_EDITED",
      bookingId: id,
      guestName,
      details: `${property} | ${checkIn} → ${checkOut} | Status: ${newStatus}`,
    });

    res.json({ success: true, message: "Booking updated!" });
  } catch (error) {
    console.error("Edit error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PATCH /api/bookings/:id/status — Update status only */
app.patch("/api/bookings/:id/status", async (req, res) => {
  try {
    const { id }     = req.params;
    const { status, cancelReason, refundIssued } = req.body;

    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, id);

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Update columns N (status), P (cancelReason), Q (refundIssued)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!N${rowIndex + 1}:Q${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status, "", cancelReason || "", refundIssued || ""]] },
    });

    await logActivity(sheets, {
      action: status === "Cancelled" ? "BOOKING_CANCELLED" : "STATUS_CHANGED",
      bookingId: id,
      guestName: "",
      details: status === "Cancelled"
        ? `Cancelled | Reason: ${cancelReason} | Refund: ${refundIssued}`
        : `New status: ${status}`,
    });

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** DELETE /api/bookings/:id — Delete a booking */
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sheets = getSheetsClient();

    const rowIndex = await findRowIndex(sheets, id);
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const sheetId = await getSheetId(sheets);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        }],
      },
    });

    await logActivity(sheets, {
      action: "BOOKING_DELETED",
      bookingId: id,
      guestName: "",
      details: `Row ${rowIndex + 1} deleted`,
    });

    res.json({ success: true, message: "Booking deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG ROUTES
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/activity — Fetch activity log (newest first) */
app.get("/api/activity", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ACTIVITY_SHEET}!A:F`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, activities: [] });

    const activities = rows.slice(1).map((row) => ({
      timestamp: row[0] || "",
      action:    row[1] || "",
      bookingId: row[2] || "",
      guestName: row[3] || "",
      details:   row[4] || "",
      user:      row[5] || "Host",
    })).reverse(); // newest first

    res.json({ success: true, activities });
  } catch (error) {
    // If ActivityLog sheet doesn't exist yet, return empty
    res.json({ success: true, activities: [] });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_, res) =>
  res.json({ success: true, message: "Server is running!", timestamp: new Date() })
);

app.listen(PORT, () => {
  console.log(`\n🏠 Airbnb Tracker Backend running on http://localhost:${PORT}`);
  console.log(`📊 Connected to Sheet ID: ${SPREADSHEET_ID || "NOT SET"}\n`);
});

// ══════════════════════════════════════════════════════════════════════════════
// PROPERTIES ROUTES (Phase 5)
// ══════════════════════════════════════════════════════════════════════════════

const PROPERTIES_SHEET = process.env.PROPERTIES_SHEET || "Properties";

// ─── Ensure Properties sheet headers ─────────────────────────────────────────
async function ensurePropertiesHeaders(sheets) {
  const headers = [
    "Property Name", "Description", "Photo URL",
    "No Overlap", "Max Guests", "Price Per Night", "Created At"
  ];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROPERTIES_SHEET}!A1:G1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PROPERTIES_SHEET}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
  } catch (err) {
    console.warn("Properties sheet header check failed:", err.message);
  }
}

// ─── Find property row index ──────────────────────────────────────────────────
async function findPropertyRow(sheets, name) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PROPERTIES_SHEET}!A:A`,
  });
  const rows = res.data.values || [];
  return rows.findIndex((r) => r[0] === name);
}

// ─── GET /api/properties ──────────────────────────────────────────────────────
app.get("/api/properties", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    await ensurePropertiesHeaders(sheets);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROPERTIES_SHEET}!A:G`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, properties: [] });

    const properties = rows.slice(1).map((row) => ({
      name:          row[0] || "",
      description:   row[1] || "",
      photoUrl:      row[2] || "",
      noOverlap:     row[3] === "true" || row[3] === "TRUE",
      maxGuests:     parseInt(row[4]) || 10,
      pricePerNight: parseFloat(row[5]) || 0,
      createdAt:     row[6] || "",
    })).filter((p) => p.name);

    res.json({ success: true, properties });
  } catch (error) {
    console.error("Error fetching properties:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/properties ─────────────────────────────────────────────────────
app.post("/api/properties", async (req, res) => {
  try {
    const { name, description, photoUrl, noOverlap, maxGuests, pricePerNight } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Property name is required" });

    const sheets = getSheetsClient();
    await ensurePropertiesHeaders(sheets);

    // Check for duplicate name
    const existing = await findPropertyRow(sheets, name);
    if (existing !== -1) {
      return res.status(409).json({ success: false, message: "A property with this name already exists" });
    }

    const row = [
      name, description || "", photoUrl || "",
      noOverlap ? "true" : "false",
      maxGuests || 10, pricePerNight || 0,
      new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROPERTIES_SHEET}!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    await logActivity(sheets, {
      action: "BOOKING_ADDED", bookingId: "", guestName: "",
      details: `New property added: ${name}`,
    });

    res.json({ success: true, message: "Property added!", name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/properties/:name ────────────────────────────────────────────────
app.put("/api/properties/:name", async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { name, description, photoUrl, noOverlap, maxGuests, pricePerNight } = req.body;

    const sheets   = getSheetsClient();
    const rowIndex = await findPropertyRow(sheets, oldName);

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PROPERTIES_SHEET}!A${rowIndex + 1}:F${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          name || oldName, description || "", photoUrl || "",
          noOverlap ? "true" : "false",
          maxGuests || 10, pricePerNight || 0,
        ]],
      },
    });

    res.json({ success: true, message: "Property updated!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── DELETE /api/properties/:name ────────────────────────────────────────────
app.delete("/api/properties/:name", async (req, res) => {
  try {
    const name   = decodeURIComponent(req.params.name);
    const sheets = getSheetsClient();

    const rowIndex = await findPropertyRow(sheets, name);
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Get sheet numeric ID
    const info    = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet   = info.data.sheets.find((s) => s.properties.title === PROPERTIES_SHEET);
    const sheetId = sheet?.properties?.sheetId ?? 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        }],
      },
    });

    res.json({ success: true, message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
