# Trust Land Initiative — Samity Manager

A lightweight, mobile-first web app to manage a savings group (samity) — track members, monthly payments, nominees, and fund balance. All data lives in a Google Sheet; the frontend is a single HTML file hosted on GitHub Pages.

---

## Architecture

```
GitHub Pages (index.html)  ──→  Google Apps Script (Web App)  ──→  Google Sheets
     Frontend                        Backend / API                    Database
```

- **Frontend** — `index.html` — pure HTML + CSS + vanilla JS, no build step
- **Backend** — `apps-script.js` — deployed as a Google Apps Script Web App, acts as a REST-like API over GET requests
- **Database** — Google Sheet with 4 tabs: `Members`, `Payments`, `Nominees`, `Settings`

---

## Google Sheet Structure

| Sheet | Columns |
|---|---|
| Members | `id`, `name`, `phone` |
| Payments | `memberId`, `year`, `month`, `amount` |
| Nominees | `memberId`, `name`, `phone`, `relation` |
| Settings | `key`, `value` |

All sheets are created automatically on the first API call if they don't exist.

---

## API Actions

All requests go to the deployed Apps Script URL as GET parameters (`?action=...`).

| Action | Auth required | What it does |
|---|---|---|
| `getAll` | No | Returns all members, payments, nominees, settings in one call |
| `savePayment` | Admin | Insert or update a single month's payment for a member |
| `addMember` | Admin | Append a new member row |
| `editMember` | Admin | Update name and phone for an existing member |
| `deleteMember` | Admin | Remove a member row |
| `saveNominee` | Admin | Insert or update a member's nominee (name, phone, relation) |
| `saveSettings` | Admin | Update opening balance, monthly target, or currency |
| `checkPassword` | — | Validates the admin password |

Authentication is a shared password verified against a SHA-256 hash (`ADMIN_PASSWORD_HASH` in the script). Wrong password returns `{ ok: false, error: "Wrong password" }`.

---

## Frontend Features

### Tabs

| Tab | Visible to | Purpose |
|---|---|---|
| Dashboard | Everyone | Summary metrics + current month payment status table |
| Payments | Everyone (view) / Admin (edit) | Full 12-month payment grid per member |
| Nominees | Everyone (view) / Admin (edit) | Emergency contact for each member |
| Members | Admin only | Add, edit, delete members |
| Settings | Admin only | Change balance, target, currency, manage years |

### Dashboard Metrics

- **Prior savings** — money in the fund before payment tracking began (set manually in Settings)
- **Collected this year** — sum of all recorded payments for the selected year
- **Grand total** — prior savings + collected this year
- **Total members** — count of members in the sheet

> ⚠️ **Important:** Prior savings and payment records are separate. Do not enter the same money in both — it will be double-counted in the grand total.

- Current month breakdown: how many members paid / partial / unpaid, and total collected that month

### Search & Filtering

Available on every tab (Dashboard, Payments, Nominees, Members):

- Filters by **member name** or **phone number** simultaneously
- Input is debounced (250ms) — renders only after the user pauses typing, keeping mobile keyboards stable
- Resets to page 1 on every new search
- `autocomplete`, `autocorrect`, and `autocapitalize` are disabled to prevent mobile keyboard interference
- Font size forced to 16px to prevent iOS Safari from auto-zooming the viewport

### Pagination

- 10 members per page (configurable via `PAGE_SIZE` in the script)
- **Smart pagination** — shows at most 7 buttons with `…` ellipsis; never overflows on narrow screens:
  ```
  Near start:  < [1][2][3][4][5]…[12] >
  Middle:      < [1]…[4][5][6]…[12] >
  Near end:    < [1]…[8][9][10][11][12] >
  ```
- Previous / next arrow buttons are disabled at the boundaries
- Pagination resets to page 1 when the year changes or a search is applied

### Payments Tab

- One row per member, one column per month (Jan–Dec)
- Admins can type directly into each cell; saves to Google Sheets automatically after a short debounce (600ms)
- Monthly totals row at the bottom
- View-only mode for non-admins

### Nominees Tab

- Stores one nominee per member: name, phone, relation (e.g. Wife, Brother)
- Data synced to Google Sheets — visible on all devices
- Inline editing: click the edit icon, fill in fields, press Enter or ✓ to save

### Members Tab (Admin only)

- Add a new member (name + phone)
- Edit existing member details inline
- Delete a member (payment records are kept in the sheet)

### Settings Tab (Admin only)

- **Prior savings / carry-forward** — lump sum from before tracking started
- **Monthly target per member** — used to determine Paid / Partial / Unpaid status
- **Currency symbol** — shown throughout the UI (default: ৳)
- **Year management** — add years to the year selector dropdown
- **Export CSV** — downloads all payment data for the selected year
- **Reset connection** — clears the stored API URL (for reconnecting to a different sheet)

### Admin Login

- A lock icon appears in the header for non-admins
- Password is checked against the backend (`checkPassword` action)
- Admin session is stored in `localStorage` so you stay logged in after refresh
- Logout button clears the session

---

## Mobile UX

The app is designed to work cleanly on phones:

| Area | Behaviour |
|---|---|
| Search input | 16px font prevents iOS auto-zoom; `onchange` fallback catches paste / autocomplete |
| Pagination buttons | 44px touch target on mobile (Apple HIG minimum); `touch-action: manipulation` removes 300ms tap delay |
| Tab bar | `touch-action: manipulation` on every tab button |
| Search wrap | Stretches to full card width on small screens |
| Metrics grid | 2-column grid on mobile (4-column on desktop) |
| Header buttons | Labels hidden on mobile — icon-only to save space |
| Dark mode | Automatic via `prefers-color-scheme` |

---

## How Data Flows

### On page load
```
start()
  └─ loadData()
       └─ api({ action: 'getAll' })
            └─ Google Sheets → returns members + payments + nominees + settings
                 └─ initApp(d) → stores in memory → render()
```

### On payment edit (admin)
```
user types in cell
  └─ updatePayment() — updates local state instantly (UI stays responsive)
       └─ debounce 600ms
            └─ api({ action: 'savePayment', ... }) → writes to Google Sheet
```

### On nominee save (admin)
```
user clicks ✓
  └─ saveNomineeEdit()
       └─ api({ action: 'saveNominee', ... }) → writes to Google Sheet
            └─ on success: updates state.nominees → re-renders nominees table
```

---

## Configuration

### Change the admin password
In `apps-script.js`, replace `ADMIN_PASSWORD_HASH` with the SHA-256 hash of your new password.
To get the hash, run this in the Apps Script editor console:
```js
Logger.log(hashPw("yournewpassword"))
```
Copy the logged value, paste it as the new `ADMIN_PASSWORD_HASH`, then redeploy as a new version.

### Change the connected Google Sheet
In `apps-script.js`, line 6:
```js
const SHEET_ID = "your-sheet-id-here";
```
The Sheet ID is the long string in the Google Sheets URL between `/d/` and `/edit`.

### Change the API URL in the frontend
In `index.html`:
```js
const DEFAULT_API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```
Every page load writes this value to `localStorage`, so old cached URLs are always overwritten.

---

## Deploying a Backend Change

Whenever you edit `apps-script.js`:

1. Open your Google Sheet → **Extensions → Apps Script**
2. Replace all code with the updated `apps-script.js`
3. Save (Ctrl+S)
4. **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**
5. Update `DEFAULT_API_URL` in `index.html` if the URL changed
6. Push `index.html` to GitHub — GitHub Pages serves it automatically

---

## File Structure

```
TLI/
├── index.html       # Entire frontend (HTML + CSS + JS in one file)
├── apps-script.js   # Google Apps Script backend (paste into Apps Script editor)
└── README.md        # This file
```

---

## Known Limitations

- **No real authentication** — the admin password travels in the URL query string (plain GET request). Fine for a private samity app; not suitable for sensitive public data.
- **Nominees are per-device for old users** — before the Google Sheets integration, nominees were stored in `localStorage`. After the backend update, they sync across all devices.
- **Single sheet, single samity** — the Sheet ID is hardcoded; one deployment = one samity.
- **No offline support** — all reads and writes require an internet connection to Google Sheets.
- **Search is client-side** — all members are loaded into memory on page load; the search filters that local copy. Works fine up to a few hundred members.

---

## Changelog

### Latest
- **Smart pagination with ellipsis** — replaces the flat button list; max 7 page buttons shown at once
- **44px touch targets** on pagination buttons and tabs (mobile)
- **`touch-action: manipulation`** on all interactive controls — removes 300ms tap delay on mobile browsers
- **Search debounce** (250ms) — smoother typing on mobile; no per-keystroke DOM thrash
- **iOS zoom fix** — search input forced to 16px font size to prevent Safari viewport zoom on focus
- **Full-width search** on mobile — input stretches across the card when the layout wraps
- **`onchange` fallback** on search — catches value changes from paste and autocomplete that skip `oninput`
