/**
 * server.js - Main Express server for Airbnb Booking Tracker
 * Handles API routes and Google Sheets integration
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Google Sheets Auth ───────────────────────────────────────────────────────
/**
 * Creates an authenticated Google Sheets client using a service account.
 * Credentials are loaded from environment variables (set in .env).
 */
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      // Replace escaped newlines in the private key (common .env issue)
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      token_uri: "https://oauth2.googleapis.com/token",
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || "Bookings";

// ─── Helper: Ensure Header Row Exists ────────────────────────────────────────
/**
 * Checks if the sheet has a header row. If not, creates one.
 * This runs once when the first booking is added.
 */
async function ensureHeaderRow(sheets) {
  const headers = [
    "Booking ID",
    "Guest Name",
    "Phone Number",
    "Check-in Date",
    "Check-out Date",
    "Nights",
    "Number of Guests",
    "Property / Room",
    "Total Price",
    "Advance Paid",
    "Remaining Amount",
    "Booking Source",
    "Notes",
    "Status",
    "Created At",
  ];

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:O1`,
  });

  // If the first cell is empty, write the header row
  if (!response.data.values || response.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

// ─── Helper: Generate Booking ID ─────────────────────────────────────────────
function generateBookingId() {
  const now = new Date();
  const timestamp = now.getTime().toString(36).toUpperCase();
  return `BK-${timestamp}`;
}

// ─── Helper: Calculate Nights ────────────────────────────────────────────────
function calculateNights(checkIn, checkOut) {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diffTime = Math.abs(outDate - inDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ─── Route: POST /api/bookings ────────────────────────────────────────────────
/**
 * Adds a new booking to Google Sheets.
 * Body: { guestName, phone, checkIn, checkOut, guests, property,
 *         totalPrice, advancePaid, source, notes }
 */
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      guestName,
      phone,
      checkIn,
      checkOut,
      guests,
      property,
      totalPrice,
      advancePaid,
      source,
      notes,
    } = req.body;

    // Validate required fields
    if (!guestName || !checkIn || !checkOut || !property) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: guestName, checkIn, checkOut, property",
      });
    }

    const sheets = getSheetsClient();
    await ensureHeaderRow(sheets);

    // Auto-calculate remaining amount
    const remaining = (parseFloat(totalPrice) || 0) - (parseFloat(advancePaid) || 0);
    const nights = calculateNights(checkIn, checkOut);
    const bookingId = generateBookingId();

    // Determine booking status
    const today = new Date();
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    let status = "Upcoming";
    if (today >= checkInDate && today <= checkOutDate) status = "Active";
    if (today > checkOutDate) status = "Completed";

    // Build the row to append
    const row = [
      bookingId,
      guestName,
      phone || "",
      checkIn,
      checkOut,
      nights,
      guests || 1,
      property,
      parseFloat(totalPrice) || 0,
      parseFloat(advancePaid) || 0,
      remaining,
      source || "Other",
      notes || "",
      status,
      new Date().toISOString(),
    ];

    // Append to Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    res.json({
      success: true,
      message: "Booking added successfully!",
      bookingId,
      data: { bookingId, guestName, checkIn, checkOut, nights, remaining },
    });
  } catch (error) {
    console.error("Error adding booking:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to add booking. Check server logs.",
      error: error.message,
    });
  }
});

// ─── Route: GET /api/bookings ─────────────────────────────────────────────────
/**
 * Fetches all bookings from Google Sheets.
 * Returns an array of booking objects.
 */
app.get("/api/bookings", async (req, res) => {
  try {
    const sheets = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) {
      // Only header row or empty
      return res.json({ success: true, bookings: [] });
    }

    // Skip header row (index 0), map the rest to objects
    const bookings = rows.slice(1).map((row) => ({
      bookingId: row[0] || "",
      guestName: row[1] || "",
      phone: row[2] || "",
      checkIn: row[3] || "",
      checkOut: row[4] || "",
      nights: row[5] || 0,
      guests: row[6] || 1,
      property: row[7] || "",
      totalPrice: parseFloat(row[8]) || 0,
      advancePaid: parseFloat(row[9]) || 0,
      remaining: parseFloat(row[10]) || 0,
      source: row[11] || "",
      notes: row[12] || "",
      status: row[13] || "",
      createdAt: row[14] || "",
    }));

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
      error: error.message,
    });
  }
});

// ─── Route: DELETE /api/bookings/:id ─────────────────────────────────────────
/**
 * Deletes a booking row from Google Sheets by Booking ID.
 */
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sheets = getSheetsClient();

    // Get all rows to find the row index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === id);

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Get the sheet ID (gid) to delete the row
    const sheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = sheetInfo.data.sheets.find(
      (s) => s.properties.title === SHEET_NAME
    );
    const sheetId = sheet.properties.sheetId;

    // Delete the row using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex, // 0-based
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete booking" });
  }
});

// ─── Route: GET /api/health ───────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running!", timestamp: new Date() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏠 Airbnb Tracker Backend running on http://localhost:${PORT}`);
  console.log(`📊 Connected to Sheet ID: ${SPREADSHEET_ID || "NOT SET"}\n`);
});
