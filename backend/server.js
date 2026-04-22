/**
 * server.js - StayTrack Backend
 * Multi-business, multi-user platform.
 * Each business has isolated data stored in prefixed Google Sheet tabs.
 * "Allied Apartments" uses the existing default sheet names (backward compatible).
 */

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const { google } = require("googleapis");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

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

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// ─── Fixed sheet names (global, not per-business) ────────────────────────────
const USERS_SHEET      = process.env.USERS_SHEET      || "Users";
const BUSINESSES_SHEET = process.env.BUSINESSES_SHEET || "Businesses";
const BIZ_MEMBERS_SHEET = "BusinessMembers";

// ─── Per-business dynamic sheet names ────────────────────────────────────────
// Allied Apartments uses the existing default sheet names (backward compatible).
// New businesses get prefixed sheet names: "biz123_Bookings", etc.
function getSheets(prefix) {
  const p = prefix ? `${prefix}_` : "";
  return {
    bookings:    p ? `${p}Bookings`    : (process.env.SHEET_NAME    || "Bookings"),
    activity:    p ? `${p}ActivityLog` : (process.env.ACTIVITY_SHEET || "ActivityLog"),
    properties:  p ? `${p}Properties`  : (process.env.PROPERTIES_SHEET || "Properties"),
    expenses:    p ? `${p}Expenses`    : (process.env.EXPENSES_SHEET  || "Expenses"),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function hashPassword(p) {
  return crypto.createHash("sha256").update(p + "staytrack_salt").digest("hex");
}
function generateToken(username) {
  return Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString("base64");
}
function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function generateBizId() {
  return `biz_${Date.now().toString(36)}`;
}
function generateBookingId() {
  return `BK-${Date.now().toString(36).toUpperCase()}`;
}
function calculateNights(ci, co) {
  return Math.ceil(Math.abs(new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24));
}
function deriveStatus(ci, co) {
  const t = new Date(), i = new Date(ci), o = new Date(co);
  if (t >= i && t <= o) return "Active";
  if (t > o)            return "Completed";
  return "Upcoming";
}

// ─── Ensure headers helper ────────────────────────────────────────────────────
async function ensureHeaders(sheets, sheetName, headers) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
  } catch {}
}

// ─── Log activity ─────────────────────────────────────────────────────────────
async function logActivity(sheets, activitySheet, { action, bookingId, guestName, details, user }) {
  try {
    await ensureHeaders(sheets, activitySheet, ["Timestamp","Action","Booking ID","Guest Name","Details","User"]);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${activitySheet}!A:F`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[new Date().toISOString(), action, bookingId||"", guestName||"", details||"", user||"Host"]] },
    });
  } catch {}
}

// ─── Find row by column A value ───────────────────────────────────────────────
async function findRowIndex(sheets, sheetName, value) {
  const res  = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:A` });
  return (res.data.values || []).findIndex((r) => r[0] === value);
}

// ─── Get numeric sheetId for batchUpdate ─────────────────────────────────────
async function getNumericSheetId(sheets, sheetName) {
  const info  = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = info.data.sheets.find((s) => s.properties.title === sheetName);
  return sheet?.properties?.sheetId ?? 0;
}

// ─── In-memory session store ──────────────────────────────────────────────────
const activeSessions = new Map(); // token → { username, role, createdAt }

// ══════════════════════════════════════════════════════════════════════════════
// USER AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════
async function ensureUsersHeaders(sheets) {
  await ensureHeaders(sheets, USERS_SHEET, ["Username","Password Hash","Role","Created At","Last Login"]);
}
async function getAllUsers(sheets) {
  await ensureUsersHeaders(sheets);
  const res  = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${USERS_SHEET}!A:E` });
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).map((r) => ({
    username: (r[0]||"").toLowerCase().trim(), passwordHash: r[1]||"",
    role: r[2]||"user", createdAt: r[3]||"", lastLogin: r[4]||"",
  }));
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, confirmPassword, adminCode } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required" });
    if (username.length < 3)   return res.status(400).json({ success: false, message: "Username must be at least 3 characters" });
    if (password.length < 6)   return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: "Passwords do not match" });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ success: false, message: "Username can only contain letters, numbers and underscores" });

    const sheets = getSheetsClient();
    const users  = await getAllUsers(sheets);
    if (users.find((u) => u.username === username.toLowerCase().trim())) {
      return res.status(409).json({ success: false, message: "Username already taken." });
    }

    let role = "user";
    if (users.length === 0) role = "admin";
    else if (adminCode && adminCode === (process.env.ADMIN_CODE || "staytrack_admin")) role = "admin";

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${USERS_SHEET}!A:E`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[username.toLowerCase().trim(), hashPassword(password), role, new Date().toISOString(), ""]] },
    });

    const token = generateToken(username);
    activeSessions.set(token, { username: username.toLowerCase().trim(), role, createdAt: Date.now() });
    res.json({ success: true, message: `Welcome, ${username}! 🎉`, token, username: username.toLowerCase().trim(), role });
  } catch (e) { res.status(500).json({ success: false, message: "Could not create account." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required" });

    const sheets = getSheetsClient();
    const users  = await getAllUsers(sheets);
    const user   = users.find((u) => u.username === username.toLowerCase().trim());
    if (!user) return res.status(401).json({ success: false, message: "Username not found." });
    if (hashPassword(password) !== user.passwordHash) return res.status(401).json({ success: false, message: "Incorrect password." });

    const token = generateToken(username);
    activeSessions.set(token, { username: user.username, role: user.role, createdAt: Date.now() });
    res.json({ success: true, token, username: user.username, role: user.role });
  } catch (e) { res.status(500).json({ success: false, message: "Login failed." }); }
});

app.post("/api/auth/verify", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ success: false });
  const session = activeSessions.get(token);
  if (!session || Date.now() - session.createdAt > 24 * 3600000) {
    activeSessions.delete(token);
    return res.status(401).json({ success: false });
  }
  res.json({ success: true, username: session.username, role: session.role });
});

app.post("/api/auth/logout", (req, res) => {
  activeSessions.delete(req.body.token);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// BUSINESS ROUTES
// ══════════════════════════════════════════════════════════════════════════════
async function ensureBusinessHeaders(sheets) {
  await ensureHeaders(sheets, BUSINESSES_SHEET, ["BusinessID","BusinessName","JoinCode","OwnerUsername","SheetPrefix","CreatedAt"]);
  await ensureHeaders(sheets, BIZ_MEMBERS_SHEET, ["BusinessID","Username","Role","JoinedAt"]);
}

async function getAllBusinesses(sheets) {
  try {
    const res  = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${BUSINESSES_SHEET}!A:F` });
    const rows = res.data.values || [];
    if (rows.length <= 1) return [];
    return rows.slice(1).map((r) => ({
      businessId: r[0]||"", name: r[1]||"", joinCode: r[2]||"",
      owner: r[3]||"", sheetPrefix: r[4]||"", createdAt: r[5]||"",
    }));
  } catch { return []; }
}

async function getBusinessMembers(sheets) {
  try {
    const res  = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${BIZ_MEMBERS_SHEET}!A:D` });
    const rows = res.data.values || [];
    if (rows.length <= 1) return [];
    return rows.slice(1).map((r) => ({
      businessId: r[0]||"", username: r[1]||"", role: r[2]||"member", joinedAt: r[3]||"",
    }));
  } catch { return []; }
}

// ─── GET /api/businesses/mine — businesses the current user belongs to ────────
app.get("/api/businesses/mine", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ success: false, message: "Username required" });

    const sheets    = getSheetsClient();
    await ensureBusinessHeaders(sheets);

    // Auto-create Allied Apartments if it doesn't exist yet
    const allBiz = await getAllBusinesses(sheets);
    if (!allBiz.find((b) => b.businessId === "allied_apartments")) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: `${BUSINESSES_SHEET}!A:F`,
        valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
        requestBody: { values: [["allied_apartments", "Allied Apartments", "ALLIED001", "system", "", new Date().toISOString()]] },
      });
      // Add this user as admin of Allied Apartments
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: `${BIZ_MEMBERS_SHEET}!A:D`,
        valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
        requestBody: { values: [["allied_apartments", username, "admin", new Date().toISOString()]] },
      });
    }

    const businesses = await getAllBusinesses(sheets);
    const members    = await getBusinessMembers(sheets);

    // Find businesses this user is a member of
    const myMemberships = members.filter((m) => m.username.toLowerCase() === username.toLowerCase());
    const myBusinesses  = myMemberships.map((m) => {
      const biz = businesses.find((b) => b.businessId === m.businessId);
      if (!biz) return null;
      const memberCount = members.filter((mm) => mm.businessId === m.businessId).length;
      return { ...biz, userRole: m.role, memberCount };
    }).filter(Boolean);

    res.json({ success: true, businesses: myBusinesses });
  } catch (e) {
    console.error("Get businesses error:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── POST /api/businesses — Create a new business ────────────────────────────
app.post("/api/businesses", async (req, res) => {
  try {
    const { name, username } = req.body;
    if (!name || !username) return res.status(400).json({ success: false, message: "Business name and username are required" });

    const sheets     = getSheetsClient();
    await ensureBusinessHeaders(sheets);

    const allBiz     = await getAllBusinesses(sheets);
    const duplicate  = allBiz.find((b) => b.name.toLowerCase() === name.toLowerCase().trim());
    if (duplicate) return res.status(409).json({ success: false, message: "A business with this name already exists" });

    const businessId   = generateBizId();
    const joinCode     = generateJoinCode();
    const sheetPrefix  = businessId.replace("biz_", "b");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${BUSINESSES_SHEET}!A:F`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[businessId, name.trim(), joinCode, username, sheetPrefix, new Date().toISOString()]] },
    });

    // Add creator as admin member
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${BIZ_MEMBERS_SHEET}!A:D`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[businessId, username, "admin", new Date().toISOString()]] },
    });

    res.json({ success: true, message: `"${name}" created!`, businessId, joinCode, sheetPrefix });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── POST /api/businesses/join — Join with a code ────────────────────────────
app.post("/api/businesses/join", async (req, res) => {
  try {
    const { joinCode, username } = req.body;
    if (!joinCode || !username) return res.status(400).json({ success: false, message: "Join code and username are required" });

    const sheets   = getSheetsClient();
    await ensureBusinessHeaders(sheets);

    const allBiz   = await getAllBusinesses(sheets);
    const biz      = allBiz.find((b) => b.joinCode.toUpperCase() === joinCode.toUpperCase().trim());
    if (!biz) return res.status(404).json({ success: false, message: "Invalid join code. Please check and try again." });

    const members  = await getBusinessMembers(sheets);
    const already  = members.find((m) => m.businessId === biz.businessId && m.username.toLowerCase() === username.toLowerCase());
    if (already)   return res.status(409).json({ success: false, message: `You are already a member of "${biz.name}"` });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${BIZ_MEMBERS_SHEET}!A:D`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[biz.businessId, username, "member", new Date().toISOString()]] },
    });

    res.json({ success: true, message: `Joined "${biz.name}" successfully!`, business: biz });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /api/businesses/:id/code — Get join code (admin only) ────────────────
app.get("/api/businesses/:id/code", async (req, res) => {
  try {
    const sheets = getSheetsClient();
    const allBiz = await getAllBusinesses(sheets);
    const biz    = allBiz.find((b) => b.businessId === req.params.id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found" });
    res.json({ success: true, joinCode: biz.joinCode, name: biz.name });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE — Extract business context from all data routes
// All data routes accept ?businessId= to scope data correctly
// ══════════════════════════════════════════════════════════════════════════════
function getSheetPrefix(req) {
  // Allied Apartments has no prefix (uses existing sheet names)
  const bizId = req.query.businessId || req.body?.businessId || "";
  if (!bizId || bizId === "allied_apartments") return "";
  // For other businesses, derive prefix from businessId
  return bizId.replace("biz_", "b");
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/bookings", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const { guestName, phone, checkIn, checkOut, guests, property, totalPrice, advancePaid, source, notes } = req.body;
    if (!guestName || !checkIn || !checkOut || !property) return res.status(400).json({ success: false, message: "Missing required fields" });

    const sheets = getSheetsClient();
    await ensureHeaders(sheets, SN.bookings, ["Booking ID","Guest Name","Phone Number","Check-in Date","Check-out Date","Nights","Number of Guests","Property / Room","Total Price","Advance Paid","Remaining Amount","Booking Source","Notes","Status","Created At","Cancel Reason","Refund Issued"]);

    const remaining  = (parseFloat(totalPrice)||0) - (parseFloat(advancePaid)||0);
    const nights     = calculateNights(checkIn, checkOut);
    const bookingId  = generateBookingId();
    const status     = deriveStatus(checkIn, checkOut);
    const row        = [bookingId, guestName, phone||"", checkIn, checkOut, nights, guests||1, property, parseFloat(totalPrice)||0, parseFloat(advancePaid)||0, remaining, source||"Other", notes||"", status, new Date().toISOString(), "", ""];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${SN.bookings}!A:Q`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
    await logActivity(sheets, SN.activity, { action: "BOOKING_ADDED", bookingId, guestName, details: `${property} | ${checkIn} → ${checkOut} | PKR ${totalPrice}` });
    res.json({ success: true, message: "Booking added!", bookingId, data: { bookingId, guestName, checkIn, checkOut, nights, remaining } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SN.bookings}!A:Q` });
    const rows   = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, bookings: [] });
    const bookings = rows.slice(1).map((r) => ({
      bookingId: r[0]||"", guestName: r[1]||"", phone: r[2]||"", checkIn: r[3]||"", checkOut: r[4]||"",
      nights: r[5]||0, guests: r[6]||1, property: r[7]||"",
      totalPrice: parseFloat(r[8])||0, advancePaid: parseFloat(r[9])||0, remaining: parseFloat(r[10])||0,
      source: r[11]||"", notes: r[12]||"", status: r[13]||"", createdAt: r[14]||"",
      cancelReason: r[15]||"", refundIssued: r[16]||"",
    }));
    res.json({ success: true, bookings });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const { id } = req.params;
    const { guestName, phone, checkIn, checkOut, guests, property, totalPrice, advancePaid, source, notes, status } = req.body;
    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, SN.bookings, id);
    if (rowIndex === -1) return res.status(404).json({ success: false, message: "Booking not found" });
    const remaining = (parseFloat(totalPrice)||0) - (parseFloat(advancePaid)||0);
    const nights    = calculateNights(checkIn, checkOut);
    const newStatus = status || deriveStatus(checkIn, checkOut);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SN.bookings}!A${rowIndex+1}:N${rowIndex+1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[id, guestName, phone||"", checkIn, checkOut, nights, guests||1, property, parseFloat(totalPrice)||0, parseFloat(advancePaid)||0, remaining, source||"Other", notes||"", newStatus]] },
    });
    await logActivity(sheets, SN.activity, { action: "BOOKING_EDITED", bookingId: id, guestName, details: `${property} | ${checkIn} → ${checkOut} | Status: ${newStatus}` });
    res.json({ success: true, message: "Booking updated!" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.patch("/api/bookings/:id/status", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const { id } = req.params;
    const { status, cancelReason, refundIssued } = req.body;
    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, SN.bookings, id);
    if (rowIndex === -1) return res.status(404).json({ success: false, message: "Booking not found" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SN.bookings}!N${rowIndex+1}:Q${rowIndex+1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[status, "", cancelReason||"", refundIssued||""]] },
    });
    await logActivity(sheets, SN.activity, { action: status === "Cancelled" ? "BOOKING_CANCELLED" : "STATUS_CHANGED", bookingId: id, details: `Status: ${status}` });
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const { id } = req.params;
    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, SN.bookings, id);
    if (rowIndex === -1) return res.status(404).json({ success: false, message: "Booking not found" });
    const sheetId  = await getNumericSheetId(sheets, SN.bookings);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex+1 } } }] },
    });
    await logActivity(sheets, SN.activity, { action: "BOOKING_DELETED", bookingId: id });
    res.json({ success: true, message: "Booking deleted" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get("/api/bookings/:id/invoice", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SN.bookings}!A:Q` });
    const row = (response.data.values||[]).find((r) => r[0] === req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Booking not found" });
    res.json({ success: true, booking: {
      bookingId: row[0], guestName: row[1], phone: row[2], checkIn: row[3], checkOut: row[4],
      nights: row[5], guests: row[6], property: row[7], totalPrice: parseFloat(row[8])||0,
      advancePaid: parseFloat(row[9])||0, remaining: parseFloat(row[10])||0,
      source: row[11], notes: row[12], status: row[13], createdAt: row[14],
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROPERTIES ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/properties", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const sheets = getSheetsClient();
    await ensureHeaders(sheets, SN.properties, ["Property Name","Description","Photo URL","No Overlap","Max Guests","Price Per Night","Created At"]);
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SN.properties}!A:G` });
    const rows = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, properties: [] });
    const properties = rows.slice(1).map((r) => ({
      name: r[0]||"", description: r[1]||"", photoUrl: r[2]||"",
      noOverlap: r[3]==="true"||r[3]==="TRUE", maxGuests: parseInt(r[4])||10,
      pricePerNight: parseFloat(r[5])||0, createdAt: r[6]||"",
    })).filter((p) => p.name);
    res.json({ success: true, properties });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post("/api/properties", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const { name, description, photoUrl, noOverlap, maxGuests, pricePerNight } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Property name is required" });
    const sheets = getSheetsClient();
    await ensureHeaders(sheets, SN.properties, ["Property Name","Description","Photo URL","No Overlap","Max Guests","Price Per Night","Created At"]);
    const rowIndex = await findRowIndex(sheets, SN.properties, name);
    if (rowIndex !== -1) return res.status(409).json({ success: false, message: "A property with this name already exists" });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${SN.properties}!A:G`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[name, description||"", photoUrl||"", noOverlap?"true":"false", maxGuests||10, pricePerNight||0, new Date().toISOString()]] },
    });
    res.json({ success: true, message: "Property added!", name });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put("/api/properties/:name", async (req, res) => {
  try {
    const prefix   = getSheetPrefix(req);
    const SN       = getSheets(prefix);
    const oldName  = decodeURIComponent(req.params.name);
    const { name, description, photoUrl, noOverlap, maxGuests, pricePerNight } = req.body;
    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, SN.properties, oldName);
    if (rowIndex === -1) return res.status(404).json({ success: false, message: "Property not found" });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `${SN.properties}!A${rowIndex+1}:F${rowIndex+1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[name||oldName, description||"", photoUrl||"", noOverlap?"true":"false", maxGuests||10, pricePerNight||0]] },
    });
    res.json({ success: true, message: "Property updated!" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete("/api/properties/:name", async (req, res) => {
  try {
    const prefix   = getSheetPrefix(req);
    const SN       = getSheets(prefix);
    const name     = decodeURIComponent(req.params.name);
    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, SN.properties, name);
    if (rowIndex === -1) return res.status(404).json({ success: false, message: "Property not found" });
    const sheetId  = await getNumericSheetId(sheets, SN.properties);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex+1 } } }] },
    });
    res.json({ success: true, message: "Property deleted" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSES ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/expenses", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const sheets = getSheetsClient();
    await ensureHeaders(sheets, SN.expenses, ["Expense ID","Date","Property","Category","Description","Amount (PKR)","Created At"]);
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SN.expenses}!A:G` });
    const rows   = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, expenses: [] });
    const expenses = rows.slice(1).map((r) => ({
      expenseId: r[0]||"", date: r[1]||"", property: r[2]||"", category: r[3]||"",
      description: r[4]||"", amount: parseFloat(r[5])||0, createdAt: r[6]||"",
    })).filter((e) => e.expenseId);
    res.json({ success: true, expenses });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const { date, property, category, description, amount } = req.body;
    if (!date || !property || !amount) return res.status(400).json({ success: false, message: "Date, property and amount are required" });
    const sheets    = getSheetsClient();
    await ensureHeaders(sheets, SN.expenses, ["Expense ID","Date","Property","Category","Description","Amount (PKR)","Created At"]);
    const expenseId = `EX-${Date.now().toString(36).toUpperCase()}`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${SN.expenses}!A:G`,
      valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[expenseId, date, property, category||"Other", description||"", parseFloat(amount), new Date().toISOString()]] },
    });
    res.json({ success: true, message: "Expense logged!", expenseId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const prefix   = getSheetPrefix(req);
    const SN       = getSheets(prefix);
    const sheets   = getSheetsClient();
    const rowIndex = await findRowIndex(sheets, SN.expenses, req.params.id);
    if (rowIndex === -1) return res.status(404).json({ success: false, message: "Expense not found" });
    const sheetId  = await getNumericSheetId(sheets, SN.expenses);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex+1 } } }] },
    });
    res.json({ success: true, message: "Expense deleted" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG ROUTE
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/activity", async (req, res) => {
  try {
    const prefix = getSheetPrefix(req);
    const SN     = getSheets(prefix);
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SN.activity}!A:F` });
    const rows   = response.data.values || [];
    if (rows.length <= 1) return res.json({ success: true, activities: [] });
    const activities = rows.slice(1).map((r) => ({
      timestamp: r[0]||"", action: r[1]||"", bookingId: r[2]||"",
      guestName: r[3]||"", details: r[4]||"", user: r[5]||"Host",
    })).reverse();
    res.json({ success: true, activities });
  } catch { res.json({ success: true, activities: [] }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// CURRENCY ROUTE
// ══════════════════════════════════════════════════════════════════════════════
let rateCache = { rate: 278, fetchedAt: 0 };
app.get("/api/currency", async (req, res) => {
  try {
    if (Date.now() - rateCache.fetchedAt < 3600000) return res.json({ success: true, rate: rateCache.rate, cached: true });
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r.ok) { const d = await r.json(); if (d?.rates?.PKR) { rateCache = { rate: d.rates.PKR, fetchedAt: Date.now() }; } }
    res.json({ success: true, rate: rateCache.rate });
  } catch { res.json({ success: true, rate: rateCache.rate }); }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ success: true, message: "Server running!", timestamp: new Date() }));

app.listen(PORT, () => {
  console.log(`\n🏠 StayTrack Backend running on http://localhost:${PORT}`);
  console.log(`📊 Spreadsheet: ${SPREADSHEET_ID || "NOT SET"}\n`);
});
