# 🏠 StayTrack — Airbnb Booking Manager

A clean, professional web app for Airbnb hosts to track manual bookings
(WhatsApp, calls, Instagram) and auto-sync them to Google Sheets.

---

## 🧠 How the System Works

```
You fill the form → React Frontend → Node.js Backend → Google Sheets API → Your Google Sheet
                                   ↑
                             Reads bookings back
```

1. **Frontend (React)** — Beautiful dashboard to add/view/filter bookings
2. **Backend (Node.js + Express)** — Secure API that talks to Google Sheets
3. **Google Sheets** — Acts as your database (no database setup needed!)

---

## 📁 Folder Structure

```
airbnb-tracker/
├── backend/
│   ├── server.js          ← Express API + Google Sheets logic
│   ├── package.json
│   ├── .env               ← Your secret credentials (YOU create this)
│   └── .env.example       ← Template for .env
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.jsx              ← Main app, navigation, state
│       ├── App.css
│       ├── index.js
│       ├── index.css            ← Global styles + design tokens
│       ├── components/
│       │   ├── BookingForm.jsx  ← Add booking form
│       │   ├── BookingsList.jsx ← Table with filters
│       │   ├── StatsCards.jsx   ← Revenue summary tiles
│       │   └── Toast.jsx        ← Notification system
│       └── utils/
│           └── api.js           ← All API calls + CSV export
│
└── README.md
```

---

## 🔐 STEP 1: Google Sheets Setup (Required First!)

### 1A — Create a Google Sheet

1. Go to https://sheets.google.com
2. Click **"+"** to create a new blank spreadsheet
3. Name it: `Airbnb Bookings`
4. Note the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/  ← THIS LONG STRING IS THE ID →  /edit
   ```
   Example ID: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

### 1B — Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **"Select a project"** → **"New Project"**
3. Name it: `AirbnbTracker` → Click **"Create"**
4. Wait ~30 seconds for it to be created, then select it

### 1C — Enable Google Sheets API

1. In the left sidebar: **APIs & Services** → **Library**
2. Search for: `Google Sheets API`
3. Click it → Click **"Enable"**

### 1D — Create a Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** → **"Service Account"**
3. Fill in:
   - Name: `airbnb-tracker`
   - ID: (auto-filled) → Click **"Create and Continue"**
   - Skip the optional steps → Click **"Done"**
4. You'll see the service account in the list — click on its **email address**
5. Go to the **"Keys"** tab
6. Click **"Add Key"** → **"Create New Key"** → **JSON** → **"Create"**
7. A `.json` file will download — **keep this safe!**

### 1E — Share your Google Sheet with the Service Account

1. Open your Google Sheet
2. Click **"Share"** (top right)
3. Copy the `client_email` from your downloaded JSON file
   (looks like: `airbnb-tracker@your-project.iam.gserviceaccount.com`)
4. Paste it in the Share dialog
5. Set role to **"Editor"**
6. Click **"Send"** (ignore the warning about sending to an external email)

---

## ⚙️ STEP 2: Configure Environment Variables

1. Go into the `backend/` folder
2. Copy the example file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` in any text editor (Notepad, VS Code, etc.)
4. Fill in values from your downloaded JSON file:

```env
SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms

SHEET_NAME=Sheet1

GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=abc123def456...
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=airbnb-tracker@your-project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=123456789012345678901

PORT=5000
```

> ⚠️ **Important for GOOGLE_PRIVATE_KEY**:
> - Copy the entire `private_key` value from the JSON file
> - Wrap it in double quotes in .env
> - Keep the `\n` characters as-is (do NOT replace them with real newlines)

---

## 🚀 STEP 3: Run Locally

### Prerequisites
Make sure you have installed:
- **Node.js** (v16+) — download from https://nodejs.org
- **npm** (comes with Node.js)

### Start the Backend

```bash
# Open a terminal and navigate to the backend folder
cd airbnb-tracker/backend

# Install dependencies
npm install

# Start the server
npm run dev
```

You should see:
```
🏠 Airbnb Tracker Backend running on http://localhost:5000
📊 Connected to Sheet ID: 1BxiMVs...
```

### Start the Frontend

```bash
# Open a NEW terminal tab/window
cd airbnb-tracker/frontend

# Install dependencies
npm install

# Start the React app
npm start
```

Your browser will open at **http://localhost:3000** 🎉

---

## 🌐 STEP 4: Deploy to the Internet

### Option A — Render (Recommended, Free)

**Deploy Backend:**
1. Push your code to GitHub (backend folder)
2. Go to https://render.com → Sign up free
3. New → **Web Service** → Connect your GitHub repo
4. Settings:
   - Root directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add **Environment Variables** (same as your `.env` file)
6. Deploy! You'll get a URL like: `https://airbnb-tracker.onrender.com`

**Deploy Frontend:**
1. Create a file `frontend/.env.production`:
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com
   ```
2. Go to Render → New → **Static Site**
3. Root directory: `frontend`
4. Build Command: `npm install && npm run build`
5. Publish directory: `build`

### Option B — Vercel (Frontend) + Railway (Backend)

**Frontend on Vercel:**
```bash
npm install -g vercel
cd frontend
vercel
```

**Backend on Railway:**
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Add environment variables
4. Done!

---

## 🎯 Features Summary

| Feature | Status |
|---------|--------|
| Add booking with all fields | ✅ |
| Auto-calculate remaining amount | ✅ |
| Save to Google Sheets | ✅ |
| View all bookings | ✅ |
| Search by guest name / property | ✅ |
| Filter by property or status | ✅ |
| Sort by any column | ✅ |
| Highlight upcoming check-ins (3 days) | ✅ 🔔 |
| Revenue / advance / pending stats | ✅ |
| Export to CSV | ✅ |
| Delete bookings | ✅ |
| Mobile-friendly design | ✅ |
| Dark mode UI | ✅ |

---

## ❓ Troubleshooting

**"Failed to fetch bookings" error:**
- Make sure the backend is running (`npm run dev` in backend folder)
- Check your `.env` has the correct `SPREADSHEET_ID`

**"The caller does not have permission" error:**
- Make sure you shared the Google Sheet with the service account email
- The role must be "Editor" not "Viewer"

**"Private key" errors:**
- Make sure the private key in `.env` is wrapped in double quotes
- Keep the `\n` characters — don't replace with real newlines

**Bookings not appearing:**
- Click the 🔄 Refresh button in the app header
- Check the Google Sheet directly — the row should be there

---

## 💡 Tips

- The app auto-creates the header row in your sheet on first booking
- "Remaining" is always auto-calculated: Total - Advance
- 🔔 Bell icon = check-in within 3 days
- Red remaining = money still owed
- Green remaining = fully paid
