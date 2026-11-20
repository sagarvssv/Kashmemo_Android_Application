# KashMemo (Android app)

KashMemo is a petty cash and expense app for companies. Employees raise cash requests and scan their bills, managers and finance approve them, and everyone can follow each request until it is paid and closed.

This repository holds the **mobile app** (Expo / React Native). It talks to the **KashMemo backend** (Express + Prisma, separate repository) and to the **Invoice API** that reads bill photos.

| | |
|---|---|
| Package name | `com.vcloudmaster.kashmemo` |
| Live backend | `https://api.kashmemo.com` |
| Expo account / project | `vcloudmaster` / `kashmemo` |
| Store | Google Play (organisation account) |

## Contents

1. [How the app works](#1-how-the-app-works)
2. [Tech stack and project layout](#2-tech-stack-and-project-layout)
3. [Install](#3-install)
4. [Configure](#4-configure)
5. [Run the app](#5-run-the-app)
6. [Run the backend locally](#6-run-the-backend-locally)
7. [Demo accounts](#7-demo-accounts)
8. [Troubleshooting](#8-troubleshooting)
9. [Code checks](#9-code-checks)
10. [Build and release](#10-build-and-release)

---

## 1. How the app works

### Getting in

- **Welcome screen**: "Log in", or "Register your organisation".
- **Register** is for a company's **CEO** only. The CEO enters the company and their own details, then confirms their email with a code.
- **Everyone else** is added by the CEO, HR or a manager (one by one, or from a CSV file) and receives their login by email.
- **Forgot password**: enter your email, type the code you receive, then choose a new password.
- A user stays signed in on **one device at a time**. Logging in somewhere else signs out the previous device.

### Roles

Each user has one role. The home screen ("CEO Dashboard", "Finance Dashboard" and so on) and the tabs change with it.

| Role | What they do |
|---|---|
| **CEO** | Owns the organisation. Sees everything, sets budgets, manages managers and roles, approves and pays out, sees reports, can delete the organisation. |
| **Finance Manager** | Approves requests, pays out (marks as paid), closes advances, sets budgets, sees reports. |
| **HR** | Manages people and departments, sees organisation requests, can reject. |
| **Manager** | Approves requests and bills for their own departments, manages their department's people. |
| **Employee** | Raises cash requests, scans bills, follows their own requests. |

Who approves a request depends on who raised it:

| Raised by | Approved by |
|---|---|
| Employee | Manager, Finance Manager or CEO (HR can reject) |
| Manager | Finance Manager |
| Finance Manager | CEO |

Nobody can approve their own request. These rules live in [src/lib/permissions.ts](src/lib/permissions.ts) and mirror the backend, which has the final say.

### The two money flows

**A. "My own money": a bill after spending**

1. The employee pays with their own money, then taps **Scan a bill** (or **New bill**).
2. The app sends the photo to the Invoice API, which reads the shop, date, total, bill number and category. Unclear fields are highlighted for the user to check.
3. The employee checks the amount and category, chooses **My own money**, and taps **Send my bill**.
4. A manager, finance or the CEO approves it.
5. Finance taps **Mark as paid**. The employee gets the money back.

**B. Cash request: money before spending (an advance)**

1. The employee taps **Request cash**, enters the amount and what it's for, and sends it.
2. It's approved, and finance gives the cash (**Disbursed / Cash given**).
3. The employee spends it and adds each bill, choosing that cash request under **Which money did you use?**
4. The bills are reviewed, then finance closes the request (**Waiting to close → Closed**). Any difference is settled.

### Statuses

| Shown in the app | Meaning |
|---|---|
| Pending | Sent, waiting for approval |
| Partially approved | Some approvers have approved, more are needed |
| Approved | Approved, waiting for finance to pay |
| Disbursed | Money paid out / cash given |
| Waiting to close | Bills added against the cash; waiting for finance to close |
| Closed | Finished |
| Rejected | Turned down, with a reason |

### Other features

- **Budgets** per department and month; dashboards show allocated, spent and remaining.
- **Filters** by department and status on the bill lists.
- **Alerts** (notifications) for every change, plus emails for key events.
- **Reports** (CEO and Finance): paid-out list, summaries and the daily report.
- **Currency**: picked in the app (AED by default). Amounts are shown in it; they aren't converted.
- **Delete organisation** (CEO only, Menu → Delete organisation, confirmed with an email code).

### Words used in the app

The screens never say "ticket". They say **cash request** (money asked for) and **bill** (a receipt). In the code, a request is still called a `ticket`, because that's the backend's name for it.

---

## 2. Tech stack and project layout

- **Expo SDK 58**, React Native 0.88, React 19, TypeScript
- **expo-router** (file-based routes, typed routes on)
- `expo-image-picker` / `expo-document-picker` for bill photos and files
- `expo-secure-store` for the login tokens
- `socket.io-client` for live updates
- **EAS Build** for APK / AAB builds

```
src/
  app/                    Screens. Each file is a route (expo-router).
    welcome.tsx, login.tsx, signup.tsx, forgot-password.tsx, verify-otp.tsx, reset-password.tsx
    (app)/                Signed-in area
      (tabs)/             Bottom tabs: home, bills (Cash request), tickets (Bills), scan, people, alerts, profile (Menu)
      upload-bill.tsx     Scan / upload a bill
      raise-ticket.tsx    Request cash
      ticket/[id].tsx     Cash request details
      bill/[id].tsx       Bill details
      reports.tsx, departments.tsx, add-employee.tsx, upload-csv.tsx, wallet.tsx, delete-account.tsx, ...
  components/             Shared UI (buttons, chips, cards, logo, ...)
  features/               Bigger pieces per area (dashboards, advances, bills, notifications)
  context/                Session (login), theme, currency
  hooks/                  API and bill-scan hooks
  lib/                    API client, endpoints, config, permissions, formatting, types
  constants/              Theme, categories, motion
assets/                   App icon, splash, store graphics (assets/store)
plugins/                  Expo config plugins (with-optional-portrait.js)
scripts/dev.mjs           Runs Expo + backend behind one ngrok address (npm run dev)
test-bills/               Sample bill images for testing the scanner
eas.json                  Build profiles
```

Key files:

| File | What it does |
|---|---|
| [src/lib/config.ts](src/lib/config.ts) | Picks the backend URL (see [Configure](#4-configure)) |
| [src/lib/endpoints.ts](src/lib/endpoints.ts) | Every backend route the app calls |
| [src/lib/api.ts](src/lib/api.ts) | HTTP client, token refresh |
| [src/lib/invoices.ts](src/lib/invoices.ts) | Invoice API (bill reading) |
| [src/lib/permissions.ts](src/lib/permissions.ts) | Role rules |
| [src/components/brand-logo.tsx](src/components/brand-logo.tsx) | The KashMemo logo |

---

## 3. Install

**You need:**

- **Node.js 20 or newer** and npm
- **Git**
- **On your phone:** **Expo Go** from the Play Store or App Store. It must support SDK 58; update it if it's old.
- **For an Android emulator:** Android Studio with an emulator (AVD)
- **For an iOS simulator:** a Mac with Xcode
- **For tunnel mode:** [ngrok](https://ngrok.com) v3 with your authtoken added (`ngrok config add-authtoken <token>`)
- **For builds:** an Expo account with access to the `vcloudmaster` organisation, plus EAS CLI (`npm install -g eas-cli`)

**Steps:**

```bash
git clone <this repository>
cd kashmemo_android_app
npm install
```

---

## 4. Configure

Settings come from `.env.local` in the project root. Git ignores it, so **never commit it**. Create it like this:

```env
# Backend the app talks to. Live server:
EXPO_PUBLIC_API_URL=https://api.kashmemo.com

# Invoice API that reads bill photos. Leave empty to turn bill scanning off.
EXPO_PUBLIC_INVOICE_API_URL=https://pphuyyt3lb.execute-api.us-east-1.amazonaws.com/dev
```

**How the app picks the backend** ([src/lib/config.ts](src/lib/config.ts)):

1. If `EXPO_PUBLIC_API_URL` is set, it's always used: on phones, emulators and in builds.
2. If it isn't set, an **Android emulator** uses `http://10.0.2.2:3000`, which is your computer's `localhost:3000`.
3. Otherwise, a **phone** uses your computer's IP with port 3000 (the same machine Metro runs on).

**Common values:**

| You want to... | `EXPO_PUBLIC_API_URL` |
|---|---|
| Use the live server | `https://api.kashmemo.com` |
| Use a backend on your computer, from the emulator only | leave it out (empty) |
| Use a backend on your computer, from a phone on any network | your ngrok domain, e.g. `https://<name>.ngrok-free.dev` |

> **After changing `.env.local`, restart Expo with a cleared cache**: `npx expo start -c`. Values are baked in when the bundle is built.

Builds don't read `.env.local`. They take their URLs from `eas.json`.

---

## 5. Run the app

Pick one option.

| Option | Best for | Backend |
|---|---|---|
| **A. Expo Go, same Wi-Fi** | Quick testing on your phone | Live, or local on the same network |
| **B. Expo Go over ngrok** (`npm run dev`) | Phone on mobile data or another network, with a local backend | Local, through ngrok |
| **C. Android emulator** | Testing on the computer | Live or local |
| **D. iOS simulator** | iPhone layout (Mac only) | Live or local |
| **E. Preview APK** | Testing the real app without a computer | Live |

### A. Expo Go on your phone (same Wi-Fi)

```bash
npx expo start -c
```

1. Connect your phone and computer to **the same Wi-Fi**.
2. **Android:** open Expo Go and scan the QR code. **iPhone:** scan it with the Camera app.
3. The app loads. The first time takes a minute.

**Keys in the Expo terminal:**
- `r` reloads the app
- `a` opens it on the Android emulator
- `i` opens it on the iOS simulator
- `j` opens the debugger
- `m` opens the dev menu
- `Ctrl+C` stops Expo

If the phone can't connect (office Wi-Fi often blocks it), use option B.

### B. Expo Go over ngrok (any network)

`npm run dev` runs Expo and your **local backend** behind one ngrok address, so a phone on any network (even mobile data) can reach both.

1. Start the backend on port 3000 (see [section 6](#6-run-the-backend-locally)).
2. Set your ngrok domain in `.env.local`:
   ```env
   EXPO_PUBLIC_API_URL=https://<your-name>.ngrok-free.dev
   ```
   Get a free static domain at dashboard.ngrok.com → Domains.
3. Run it:
   ```bash
   npm run dev
   # extra Expo options go after --, e.g.
   npm run dev -- -c
   ```
4. Scan the QR code with Expo Go.

Avoid `npx expo start --tunnel`. Expo's built-in tunnel only forwards the app bundle, not the backend, and it often drops with "remote gone away".

If you only need the backend reachable, run `ngrok http 3000` and put that URL in `EXPO_PUBLIC_API_URL`.

### C. Android emulator

1. In Android Studio, open **Device Manager**, create a phone (e.g. Pixel, recent Android version) and start it.
2. Run:
   ```bash
   npx expo start -c
   ```
   then press **`a`**. Expo installs Expo Go on the emulator and opens the app.

- **Live backend:** keep `EXPO_PUBLIC_API_URL=https://api.kashmemo.com`.
- **Local backend:** remove `EXPO_PUBLIC_API_URL` (or comment it out) and restart with `-c`. The emulator then reaches your computer at `10.0.2.2:3000`.

Inside the emulator, `localhost` means the emulator itself, not your computer. Use `10.0.2.2`.

### D. iOS simulator (Mac only)

1. Install Xcode, open it once, and install a simulator under Settings → Platforms.
2. Run:
   ```bash
   npx expo start -c
   ```
   then press **`i`**.

The simulator shares your Mac's network, so `http://localhost:3000` works for a local backend.

### E. Preview APK (no computer needed)

Build an installable APK that uses the live server:

```bash
eas build -p android --profile preview
```

When it finishes, open the link or QR code from expo.dev on an Android phone and install it. You may need to allow "Install unknown apps".

### Web (limited)

```bash
npx expo start --web
```

Useful for quick layout checks only. The camera and some native features don't work in the browser.

---

## 6. Run the backend locally

The backend is a separate repository (`Kashmemo_Backend/kashmemo_backend/backend`).

```bash
cd <backend folder>
npm install
# create .env from .env.example (database URL, JWT secrets, AWS keys, SES email, PORT=3000, ...)
npx prisma migrate deploy      # create / update the database tables
npm run seed:demo              # optional: demo company with sample data
npm run dev                    # starts on http://localhost:3000
```

To check it's up, open `http://localhost:3000/api/health`. The live one is `https://api.kashmemo.com/api/health`.

The live server can run older code than your local `dev` branch. If a screen shows **"Route not found"**, the app is calling a route the live server doesn't have yet.

---

## 7. Demo accounts

`npm run seed:demo` (backend) creates the demo company **KashMemo Demo Pvt Ltd** with sample departments, budgets and bills. Every demo login is already verified.

| Role | Email |
|---|---|
| CEO | `ceo@kashmemo-demo.com` |
| Finance Manager | `finance@kashmemo-demo.com` |
| HR | `hr@kashmemo-demo.com` |
| Manager (Sales) | `manager@kashmemo-demo.com` |
| Manager (Operations) | `manager.ops@kashmemo-demo.com` |
| Employee | `employee@kashmemo-demo.com` |

All demo accounts share one password: ask the team lead, or see `prisma/seed-demo.ts` in the backend.

- **The demo CEO account is what Google Play reviewers use.** Don't log in with it on the live server while a store review is in progress, because that signs the reviewer out. Test with another role.
- Running the seed again resets the demo data. The logins stay the same.

---

## 8. Troubleshooting

### Expo Go / connecting

| You see | Why | Fix |
|---|---|---|
| **"Something went wrong" (blue screen)** in Expo Go | The phone can't load the app bundle from your computer | Make sure the phone and computer are on the same Wi-Fi, or use `npm run dev` (option B). Restart with `npx expo start -c`. Allow Node.js through the Windows firewall (Private networks). |
| **"Project is incompatible with this version of Expo Go"** | Expo Go doesn't match SDK 58 | Update Expo Go from the store. |
| QR code opens nothing / keeps loading | Different networks, or a VPN | Turn off VPN on both. Use the same Wi-Fi or option B. |
| **"Port 8081 is being used"** | An old Expo is still running | Stop it with `Ctrl+C`, or answer **Y** to use another port. On Windows, find and end the old `node` process. |
| Changes don't appear | Old cache | Press `r` in the terminal, or restart with `npx expo start -c`. |
| `.env.local` change has no effect | Values are baked into the bundle | Restart with `npx expo start -c`. |

### Login / network

| You see | Why | Fix |
|---|---|---|
| **Login spins, then times out** on the **emulator** | The URL points at a backend the emulator can't reach | For a local backend, remove `EXPO_PUBLIC_API_URL` so it uses `10.0.2.2:3000`, and make sure the backend runs on 3000. For live, set `https://api.kashmemo.com`. Restart with `-c`. |
| Login works on the emulator, **not on the phone** (ngrok setup) | ngrok isn't running | Start `npm run dev` again, or `ngrok http 3000`. |
| **"That item could not be found"** / **ERR_NGROK_3200** | The ngrok tunnel is offline | Start ngrok again. You don't need to change `.env.local` if the domain is the same. |
| **ERR_NGROK_334** (endpoint already online) | A previous ngrok session is still closing | Wait a few seconds; `npm run dev` retries by itself. Or stop other ngrok processes. |
| **"Network request failed"** | Wrong URL, backend down, or no internet | Open `<API URL>/api/health` in the phone's browser. If it doesn't load, the problem is the backend or URL, not the app. |
| Suddenly logged out | The same account logged in on another device (one session per user) | Log in again. Use different accounts on different devices. |
| **"Route not found"** | The backend you're calling has older code without that route | Use a backend with the matching code, or deploy the latest backend. |
| Forgot-password code never arrives | Email (SES) not set up on that backend, or the email is in spam | Check spam. For local backends, check the SES settings in `.env`. |

### Bills

| You see | Why | Fix |
|---|---|---|
| No **Scan** option / bill reading is off | `EXPO_PUBLIC_INVOICE_API_URL` is empty | Set it in `.env.local` and restart with `-c`. |
| Fields highlighted orange: "Unclear on the bill: please check" | The scanner wasn't sure about that field | Check and correct the value before sending. |
| Wrong currency symbol | The selected currency | Change the currency in the app's Menu. Amounts are relabelled, not converted. |

### Expo account / builds

| You see | Fix |
|---|---|
| `npx expo login` crashes when opening the browser | In PowerShell, run `$env:BROWSER="none"; npx expo login`, then open the printed link yourself. |
| "EAS project not configured" | Run `eas init`; the project ID is already in `app.json`. Make sure you're logged in to the right Expo account (`eas whoami`). |
| Play Console: "Required hardware feature ... screen.portrait" | Already handled by [plugins/with-optional-portrait.js](plugins/with-optional-portrait.js). Rebuild if an old build shows it. |

---

## 9. Code checks

Run these before committing:

```bash
npx tsc --noEmit          # type check
npx eslint src --quiet    # lint
npx expo-doctor           # Expo setup and dependency check
```

If you add or rename a screen and TypeScript complains about routes, start Expo once (`npx expo start`) so it regenerates the typed routes.

---

## 10. Build and release

Builds run on Expo's servers (EAS). Profiles in [eas.json](eas.json):

| Profile | Output | Use |
|---|---|---|
| `development` | APK with dev client | Debugging native code |
| `preview` | APK | Install directly on phones for testing |
| `production` | AAB | Google Play upload |

All profiles use the **live** backend (`https://api.kashmemo.com`) and the Invoice API URL in `eas.json`.

**Release a new version to Google Play:**

1. Change `"version"` in [app.json](app.json) if users should see a new version (e.g. `1.0.1`). The build number (versionCode) goes up automatically.
2. Commit and push.
3. Build:
   ```bash
   eas build -p android --profile production
   ```
4. Download the `.aab` from expo.dev.
5. In Play Console, go to **Production → Create new release**, upload the file, add release notes, and send it for review.
6. Tag the commit:
   ```bash
   git tag v1.0.1
   git push --tags
   ```

**Notes:**

- The app signing key is stored on Expo (EAS credentials). Never generate a new keystore for this app, or Play will reject updates.
- Store graphics are in [assets/store](assets/store): the 512 px icon, the feature graphic and the screenshots.
- `release/1.0.0` holds the code of the first store release, for hotfixes.
