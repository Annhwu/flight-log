# Flight Log — User Guide

A desktop logbook for **DCS World**: record, organize and review all your flight hours. All data is stored locally — no account, no cloud, no telemetry.

---

## Table of Contents

1. [First Launch](#1-first-launch)
2. [Set Up Your Profile](#2-set-up-your-profile)
3. [Log a Flight (Live Timer)](#3-log-a-flight-live-timer)
4. [Log a Past Flight (Manual Entry)](#4-log-a-past-flight-manual-entry)
5. [DCS Auto-Tracking (Beta)](#5-dcs-auto-tracking-beta)
6. [Edit or Delete a Flight](#6-edit-or-delete-a-flight)
7. [Search Your Flights](#7-search-your-flights)
8. [Add Steam Hours](#8-add-steam-hours)
9. [Customize Tag Colors](#9-customize-tag-colors)
10. [Import & Export](#10-import--export)
11. [Theme & Language](#11-theme--language)
12. [System Tray & Closing](#12-system-tray--closing)
13. [Updates](#13-updates)

---

## 1. First Launch

On first launch, a language selection screen appears.
Choose **EN**, **FR**, or **RU** — this can be changed at any time in Settings.

---

## 2. Set Up Your Profile

Before logging flights, configure your profile so that aircraft and map pickers work correctly.

1. Click the **profile button** in the top-right corner of the navbar
2. Click **Edit profile**
3. Enter your **name**
4. Optionally upload a **profile photo** *(512 × 512 px recommended — any image format)*
5. Under **Maps**, check every DCS map you own — use the search bar to filter
6. Under **Modules**, check every DCS module you own — use the search bar to filter
7. Click **Save**

> **Note:** Aircraft and map pickers in all flight forms are built from your profile.
> Nothing will appear in those pickers until you configure your owned modules and maps.

---

## 3. Log a Flight (Live Timer)

The most reliable way to log a flight — time your session in real time.

1. Click **▶ ON** in the navbar to start the timer
2. Fly your mission
3. Click **■ OFF** when you land — the debrief modal opens automatically
4. In the debrief, fill in:
   - **Flight name** *(optional)*
   - **Mission type(s)** — choose presets or add a custom type
   - **Map** — select from your owned maps
   - **Aircraft** flown — select from your owned modules
   - **Comment** *(optional)*
5. Click **Confirm** to save the session
   - Or **Skip** to save with no details
   - Or **Delete** to discard the session entirely

---

## 4. Log a Past Flight (Manual Entry)

Use this to log a flight after the fact.

1. Click **New flight** in the navbar
2. Set the **Start** date, hour, and minute
3. Set the **End** date, hour, and minute

   > ⚠️ Start and end times are required — duration is calculated from them.

4. Fill in any other fields:
   - Flight name
   - Mission type(s) — click **+** to expand the picker
   - Map — click **+** to expand the picker
   - Aircraft — click **+** to expand the picker
   - Comment
5. Click **Add** to save

---

## 5. DCS Auto-Tracking (Beta)

Flight Log can detect and record your DCS flights **automatically** through a small hook installed in your *Saved Games* folder. Each flight is written as one file, capturing real (IRL) start/end times, the map, and every aircraft you flew.

> ⚠️ **Experimental feature — please read.**
> Auto-tracking is still evolving and its file format may change between versions, so **auto-recorded flights can become corrupted or unreadable after a future update.** For reliable, long-term records, prefer the **Live Timer** (the ▶ ON button) described in section 3.

### Setup

Go to **Settings → DCS Auto-tracking**.

1. The **Saved Games/DCS folder** is detected automatically. Correct it manually if needed.
2. Click **Install hook** — this copies the tracking script into `Saved Games/DCS/Scripts/Hooks` and creates a `Saved Games/DCS/FlightLog/` folder where flight files are stored.
3. **Restart DCS** — hooks are only loaded when DCS starts.

### Importing flights

- **Import DCS sessions** — opens a picker listing detected flights. Check the ones you want, then:
  - **Import selection** — adds them to your log
  - **Delete selection** — permanently deletes the source files
  - Flights already in your log are marked *already imported*
- **Automatically import new flights** — when enabled, any flight you start **from that moment on** is added on its own while the app is open (checked every 10 seconds).
- **Diagnose** — checks that the hook is installed and writing flight files correctly.

### Good to know

- The aircraft (e.g. `F-14B`, `F/A-18C`) and the map are detected automatically and added as tags. **Multiple aircraft in one flight** are supported.
- A flight only appears **after you leave the mission** (that's when its end time is recorded).
- Deleting a flight card does **not** delete the DCS file — you can re-import it any time.

---

## 6. Edit or Delete a Flight

**To edit:**
1. On the History page, click the **pencil icon** on any session card
2. Modify any field — all edits are tracked
3. Click **Save** — a summary of your changes is shown before confirming
4. Or click **Cancel** to revert all changes

**To delete:**
- Click the **trash icon** on any session card — the session is removed immediately

---

## 7. Search Your Flights

Use the **search bar** at the top of the History page to filter sessions in real time.

You can search by:

| Search term | Example |
|---|---|
| Flight name | `Caucasus morning` |
| Flight number | `#12` |
| Notes content | `bad weather` |
| Aircraft name | `F/A-18C` |
| Mission type | `SEAD` |

---

## 8. Add Steam Hours

Your DCS Steam hours can be added to the total displayed in the navbar.

1. On the History page, click **Edit** next to the Steam label
2. Enter your total Steam hours and minutes
3. Click **Ok**

Steam hours and in-app session hours are combined into the total shown in the navbar.

---

## 9. Customize Tag Colors

Go to **Settings → Customization** to set the color of any tag.

- Pick a color for each **mission type**, **map**, or **aircraft** tag
- Each tag has a separate **Light** and **Dark** color, so it looks right in both themes
- Use the arrow buttons to copy a color from one theme variant to the other
- **Save colors** to apply, or **Reset colors** to restore defaults

---

## 10. Import & Export

### Export your log

1. Go to **Settings**
2. Check **Include profile in JSON export** if you want to include your profile (name, avatar, modules, maps)
3. Click **Export JSON** and choose a save location

> Your `ownedMaps` and `ownedModules` are always included in the export file,
> regardless of whether "Include profile" is checked.

### Import on another machine

1. Go to **Settings**
2. Choose what to import:
   - ✅ **Replace my profile** — restores your full profile (name, avatar, modules, maps)
   - ✅ **Import owned modules and maps** — restores only your collection, without touching your name or avatar
   - ✅ **Import tag colors** — restores your customized tag colors
   - Options are independent — check any combination
3. Click **Import JSON** and select your exported file

> Sessions are always imported regardless of these options.

---

## 11. Theme & Language

Go to **Settings**:

**Theme**
- **Light** — warm parchment tones
- **Dark** — deep dark brown tones

**Language**
- **EN** — English
- **FR** — Français
- **RU** — Русский

All changes apply immediately and are saved automatically.

---

## 12. System Tray & Closing

Flight Log can keep running in the background so a recording session is never lost.

- **Minimize to tray** — the app hides to the notification area instead of closing.
- **Tray menu** (right-click the tray icon) — start a flight, stop a flight, or quit.
- **Closing during an active session** — if you close the window while the Live Timer is running, a dialog asks whether to:
  - **Minimize to tray** (keep recording in the background), or
  - **Stop and close** (⚠️ the in-progress recording is lost)
- Tick **Remember my choice** to skip this dialog next time.
- You can clear that saved choice anytime in **Settings → On close (active session) → Reset**.

---

## 13. Updates

The app checks GitHub for newer releases and can install them in one click.

- When an update is available, a modal shows the new version, file size and release notes.
- Click **Install now** — the installer is downloaded, its **SHA-256 is verified**, and the app restarts into the new version.
- Enable **Include pre-releases** to also receive beta builds.
- The current version is shown in **Settings**.

---

*Flight Log — all data is stored locally on your machine. No account, no cloud, no telemetry.*
