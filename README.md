# SMART Social Manager (Windows desktop app)

Three-column Electron + React app following the hand-drawn wireframe: **SMART Company** (left) · **Social accounts** (middle) · **Main working area** (right). There is no dashboard.

## Quick start (development)
1. Install Node.js LTS. No Python or C++ build tools are needed (SQLite runs through sql.js/WebAssembly).
2. `npm install`
3. `copy .env.example .env` and edit it.
4. `npm run dev` opens the desktop window with hot reload.
5. Sign in with `SMART_ADMIN_USER` / `SMART_ADMIN_PASSWORD` from `.env` (default `admin` / `ChangeMe@123`; change it before first run, because the account is created once and stored hashed with scrypt).

## Build the Windows installer (.exe)
`npm run dist` creates `release/SMART Social Manager Setup 1.0.0.exe` (NSIS installer for Windows 10/11). The icon is `build/icon.ico`; replace it with your official SMART logo (256x256). The installed app reads its settings from `%APPDATA%\SMART Social Manager\.env`.

## Structure
- `electron/` main process (frameless window, custom title bar IPC, DPAPI-protected data key), preload.
- `server/` Express API on 127.0.0.1:4010, SQLite (`sql.js`, saved to `smart.sqlite`), AES-256-GCM token encryption, session auth, publishers, scheduler.
- `src/` React UI (`components/Accounts.jsx` middle column, `Workspace.jsx`, `Composer.jsx`, `Posts.jsx`, `Login.jsx`).
- Data (database, uploads) lives in the user data folder when packaged, `./data` otherwise.

## What is real and what is not (read this)
| Area | Status |
|---|---|
| Company login, remembered session (30 days with Remember me), logout, encrypted token storage | Working |
| Multiple accounts per platform, add/remove/disconnect/reconnect, statuses | Working |
| Composer, images/video upload, per-account captions, drafts, scheduling (app must be running), history, retry | Working |
| **Facebook Pages**: text, link, 1 or many images, video | Working with Page ID + Page access token (Meta Graph API). Not tested against live Meta here. |
| **Gmail**: Google OAuth + send with attachments | Working once `GOOGLE_CLIENT_ID/SECRET` are set. Not tested against live Google here. |
| **WhatsApp** | Status cannot be published by the official API. The app offers manual sharing (copy text, open WhatsApp). Business messaging is not implemented. |
| **Instagram, TikTok, YouTube, LinkedIn** | Account sections and composer rules exist. Publishing shows "Setup required" until you implement the adapter after the platform approves your app (see `server/publishers.js`). |
| **Demo mode** (`DEMO_MODE=true`) | Seeds sample accounts and marks results "Demo: simulated, not posted". Set `DEMO_MODE=false` for real use. |

The app never reports a post as published unless the platform API returned success.

## API setup
- **Google (Gmail)**: Google Cloud Console > enable Gmail API > OAuth consent screen > create a *Web* OAuth client > redirect URI `http://127.0.0.1:4010/oauth/google/callback` > put the ID/secret in `.env`. The `gmail.send` scope is sensitive and needs Google verification for external users.
- **Meta (Facebook/Instagram/WhatsApp)**: developers.facebook.com > create an app > add Pages API; request `pages_manage_posts`, `pages_read_engagement`. For Instagram request `instagram_content_publish`; for WhatsApp use the WhatsApp Business Platform. Generate a long-lived Page access token and paste it when adding a Facebook account.
- **TikTok** Content Posting API, **YouTube** Data API v3 (`youtube.upload`), **LinkedIn** Community Management / Share on LinkedIn: apply for access, then add an adapter in `server/publishers.js`.
- Never put client secrets in `src/`. They stay in `.env` on the server side.

## Security notes
Passwords hashed (scrypt); sessions stored as SHA-256 hashes; tokens encrypted with AES-256-GCM using a key protected by Windows DPAPI (`safeStorage`); API bound to 127.0.0.1 and requires a bearer session; login rate-limited.
