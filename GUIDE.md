# Flight Log — User Guide

---

## Table of Contents

1. [First Launch](#1-first-launch)
2. [Set Up Your Profile](#2-set-up-your-profile)
3. [Log a Flight (Live Timer)](#3-log-a-flight-live-timer)
4. [Log a Past Flight (Manual Entry)](#4-log-a-past-flight-manual-entry)
5. [Edit or Delete a Flight](#5-edit-or-delete-a-flight)
6. [Search Your Flights](#6-search-your-flights)
7. [Add Steam Hours](#7-add-steam-hours)
8. [Import & Export](#8-import--export)
9. [Change Theme or Language](#9-change-theme-or-language)

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

Use this when you want to time your session in real time.

1. Click **▶ ON** in the navbar to start the timer
2. Fly your mission
3. Click **■ OFF** when you land — the debrief modal opens automatically
4. In the debrief, fill in:
   - **Flight name** *(optional)*
   - **Aircraft** flown — select from your owned modules
   - **Map** — select from your owned maps
   - **Mission type(s)** — choose presets or add a custom type
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

## 5. Edit or Delete a Flight

**To edit:**
1. On the History page, click the **pencil icon** on any session card
2. Modify any field — all edits are tracked
3. Click **Save** — a summary of your changes is shown before confirming
4. Or click **Cancel** to revert all changes

**To delete:**
- Click the **trash icon** on any session card — the session is removed immediately

---

## 6. Search Your Flights

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

## 7. Add Steam Hours

Your DCS Steam hours can be added to the total displayed in the navbar.

1. On the History page, click **Edit** next to the Steam label
2. Enter your total Steam hours and minutes
3. Click **Ok**

Steam hours and in-app session hours are combined into the total shown in the navbar.

---

## 8. Import & Export

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
   - Both options are independent — check one, both, or neither
3. Click **Import JSON** and select your exported file

> Sessions are always imported regardless of these options.

---

## 9. Change Theme or Language

Go to **Settings**:

**Theme**
- **Light** — warm parchment tones
- **Dark Brown** — deep dark brown tones

**Language**
- **EN** — English
- **FR** — Français
- **RU** — Русский

All changes apply immediately and are saved automatically.

---

*Flight Log — all data is stored locally on your machine. No account, no cloud, no telemetry.*
