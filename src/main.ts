// This file is a module (has top-level imports/exports) so declare global works.
export { };

import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { initI18n, t, tAll, setLang, getLocale, applyStaticTranslations } from './i18n';
import { boringAvatar } from './vendor/avatar';
import { mdParse } from './vendor/markdown';

// ─── Types ─────────────────────────────────────────────────────────────────

interface UpdateAsset {
  name: string;
  size: number;
  size_fmt: string;
  download_url: string;
  sha256: string;
}

interface UpdateInfo {
  current_version: string;
  new_version: string;
  body: string;
  is_prerelease: boolean;
  asset: UpdateAsset;
}

interface Session {
  id: number;
  startTs: number;
  endTs: number;
  durationMin: number;
  name?: string;
  notes?: string;
  aircraft?: string[];
  missionTypes?: string[];
  maps?: string[];
}

const MISSION_TYPES = ['Training', 'CAP', 'CAS', 'SEAD', 'Strike', 'Intercept', 'Recon', 'Anti-Ship'];

const TAG_COLOR_DEFAULTS: Record<string, { light: string; dark: string }> = {
  'Training':  { light: '#137f11', dark: '#137f11' },
  'CAP':       { light: '#7c7c7c', dark: '#7c7c7c' },
  'CAS':       { light: '#bfb058', dark: '#bfb058' },
  'SEAD':      { light: '#a30000', dark: '#a30000' },
  'Strike':    { light: '#181818', dark: '#181818' },
  'Intercept': { light: '#ad5811', dark: '#ad5811' },
  'Recon':     { light: '#165f23', dark: '#165f23' },
  'Anti-Ship': { light: '#08719e', dark: '#08719e' },
};
const TAG_MAP_DEFAULT = { light: '#4a3d32', dark: '#27211b' } as const;
const TAG_AIRCRAFT_DEFAULT = { light: '#4a3d32', dark: '#27211b' } as const;

const DCS_MAPS: { name: string; key: string; abbr?: string }[] = [
  { name: 'Caucasus',                       key: 'map_caucasus'       },
  { name: 'Marianne WWII',                  key: 'map_marianne_wwii'  },
  { name: 'Cold War Germany',               key: 'map_cwg',            abbr: 'CWG'  },
  { name: 'Afghanistan',                    key: 'map_afghanistan'    },
  { name: 'Iraq',                           key: 'map_iraq'           },
  { name: 'Kola',                           key: 'map_kola'           },
  { name: 'Sinaï',                          key: 'map_sinai'          },
  { name: 'Normandie 2.0',                  key: 'map_normandie20'    },
  { name: 'Atlantique Sud',                 key: 'map_south_atlantic' },
  { name: 'Marianas',                       key: 'map_marianas'       },
  { name: 'Syrie',                          key: 'map_syria'          },
  { name: 'La Manche',                      key: 'map_channel'        },
  { name: 'Golfe Persique',                 key: 'map_persian_gulf'   },
  { name: 'Normandie 1944',                 key: 'map_normandie1944'  },
  { name: 'Nevada Test and Training Range', key: 'map_nttr',           abbr: 'NTTR' },
];

interface DCSModule {
  name: string;
  variants?: string[];
  includes?: string[];
}

interface Profile {
  name: string;
  modules: string[];
  maps: string[];
  exportProfile?: boolean;
  importProfile?: boolean;
  importMapsModules?: boolean;
  importTagColors?: boolean;
  avatar?: string;
}

interface AppData {
  steamMinutes: number;
  sessions: Session[];
  profile?: Profile;
  ownedMaps?: string[];
  ownedModules?: string[];
  tagColors?: Record<string, {light:string;dark:string}>;
}

interface EditResult {
  start: Date;
  end: Date;
  dur: number;
}

interface DialogSaveOptions {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

// ─── Tauri bridge ──────────────────────────────────────────────────────────

declare global {
  interface Window {
    __TAURI_INTERNALS__: {
      invoke: <T>(cmd: string, args?: unknown) => Promise<T>;
    };
    toggleSession: () => void;
    exportJSON: () => Promise<void>;
    importJSON: () => void;
    loadFile: (event: Event) => void;
    toggleSteamEdit: () => void;
    saveSteam: () => Promise<void>;
    toggleEdit: (id: number) => void;
    cancelEdit: (id: number) => void;
    saveEdit: (id: number) => Promise<void>;
    deleteSession: (id: number) => Promise<void>;
    updateEditResult: (id: number) => void;
    tbMinimize: () => void;
    tbMaximize: () => void;
    tbClose: () => void;
    toggleCard: (id: number) => void;
    confirmDebrief: () => Promise<void>;
    skipDebrief: () => Promise<void>;
    filterSessions: () => void;
    showProfile: () => void;
    hideProfile: () => void;
    editProfile: () => void;
    cancelEditProfile: () => void;
    saveProfile: () => Promise<void>;
  }
}

async function invoke<T>(cmd: string, args?: unknown): Promise<T> {
  return window.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

// ─── State ─────────────────────────────────────────────────────────────────

const DCS_MODULES: DCSModule[] = [
  { name: 'A-10A FC', variants: ['A-10A'] },
  { name: 'A-10C II' },
  { name: 'AH-64D' },
  { name: 'AJS-37' },
  { name: 'AV-8B' },
  { name: 'Bf 109 K-4' },
  { name: 'C-101' },
  { name: 'C-130J' },
  { name: 'CH-47F' },
  { name: 'Christen Eagle II' },
  { name: 'F-100D' },
  { name: 'F-14A/B/BU', variants: ['F-14A', 'F-14B', 'F-14BU'] },
  { name: 'F-15C' },
  { name: 'F-15E' },
  { name: 'F-16C' },
  { name: 'F-4E' },
  { name: 'F-5E Belsimtek' },
  { name: 'F-5E Remastered' },
  { name: 'F-86F Belsimtek' },
  { name: 'F-86F FC' },
  { name: 'F/A-18C' },
  { name: 'F4U-1D' },
  { name: 'FC3', variants: ['A-10A', 'Su-27', 'Su-33', 'Su-25', 'F-15C', 'MiG-29A', 'MiG-29S'], includes: ['A-10A FC', 'Su-27 FC', 'Su-33 FC', 'Su-25 FC', 'F-15C', 'MiG-29 FC'] },
  { name: 'Fw 190' },
  { name: 'Fw 190 A-8' },
  { name: 'Hawk T.1A' },
  { name: 'I-16' },
  { name: 'JF-17' },
  { name: 'Ka-50' },
  { name: 'L-39' },
  { name: 'La-7' },
  { name: 'M-2000C' },
  { name: 'MB-339' },
  { name: 'Mi-24P' },
  { name: 'Mi-8MTV2' },
  { name: 'MiG-15bis Belsimtek' },
  { name: 'MiG-15bis FC' },
  { name: 'MiG-19P' },
  { name: 'MiG-21bis' },
  { name: 'MiG-29 FC', variants: ['MiG-29A', 'MiG-29S'] },
  { name: 'MiG-29A 9.12' },
  { name: 'Mirage F1' },
  { name: 'Mosquito FB VI' },
  { name: 'OH-58D' },
  { name: 'P-47D' },
  { name: 'P-51D' },
  { name: 'SA342' },
  { name: 'Spitfire LF Mk. IX' },
  { name: 'Su-25 FC', variants: ['Su-25'] },
  { name: 'Su-27 FC', variants: ['Su-27'] },
  { name: 'Su-33 FC', variants: ['Su-33'] },
  { name: 'UH-1H' },
  { name: 'Yak-52' },
];

let sessions: Session[] = [];
let steamMinutes = 0;
let activeStart: Date | null = null;
let elapsedInterval: number | null = null;
let pendingSession: Session | null = null;
let profile: Profile = { name: '', modules: [], maps: [] };
let settingsDirty = false;
let pendingNewFlightNav: (() => void) | null = null;
let profileEditing = false;
let pendingAvatarChange: string | null | undefined = undefined;
let editingCardId: number | null = null;
let pendingCardNav: (() => void) | null = null;
let _pendingTagColorNav: (() => void) | null = null;

// ─── Utilitaires ───────────────────────────────────────────────────────────

function pad(n: number): string { return String(n).padStart(2, '0'); }
function escapeHtml(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtTime(d: Date): string { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function fmtDate(d: Date): string { return d.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtDateInput(d: Date): string { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function minsToHM(m: number): string { const h = Math.floor(m / 60), mm = Math.round(m % 60); return pad(h) + 'h ' + pad(mm) + 'm'; }
function secsToHMS(s: number): string { const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.round(s % 60); return pad(h) + 'h ' + pad(mm) + 'm ' + pad(ss) + 's'; }
function durLabel(min: number): string { const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = Math.round(min % 60); return (d > 0 ? d + 'j ' : '') + pad(h) + 'h ' + pad(m) + 'm'; }

// ─── Sauvegarde automatique via Tauri ──────────────────────────────────────

async function saveToFile(): Promise<void> {
  const data: AppData = { steamMinutes, sessions, profile };
  await invoke('save_data', { content: JSON.stringify(data, null, 2) });
  showSaveIndicator();
}

async function loadFromFile(): Promise<void> {
  try {
    const content = await invoke<string>('load_data');
    if (content) {
      const data: AppData = JSON.parse(content);
      steamMinutes = data.steamMinutes ?? 0;
      sessions = data.sessions ?? [];
      profile  = data.profile  ?? { name: '', modules: [], maps: [] };
      if (!profile.maps) profile.maps = [];
      if (!profile.modules) profile.modules = [];
    }
  } catch {
    // Pas de fichier existant, on démarre vide
  }
}

// ─── Context menu ──────────────────────────────────────────────────────────
(function initContextMenu() {
  const menu = document.createElement('div');
  menu.id = 'ctx-menu';
  document.body.appendChild(menu);

  function renderMenu() {
    const cutBtn  = document.createElement('button'); cutBtn.id  = 'ctx-cut';
    const copyBtn = document.createElement('button'); copyBtn.id = 'ctx-copy';
    const pasteBtn= document.createElement('button'); pasteBtn.id= 'ctx-paste';
    cutBtn.textContent   = t('ctx_cut');
    copyBtn.textContent  = t('ctx_copy');
    pasteBtn.textContent = t('ctx_paste');
    menu.innerHTML = '';
    menu.append(cutBtn, copyBtn, pasteBtn);
    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
      const sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid var(--border);margin:4px 0;';
      const inspectBtn = document.createElement('button');
      inspectBtn.textContent = 'Inspecter';
      inspectBtn.addEventListener('click', async () => {
        hide();
        try {
          await invoke('plugin:webview|internal_toggle_devtools', { label: getCurrentWebviewWindow().label });
        } catch (e) { console.error('[devtools]', e); }
      });
      menu.append(sep, inspectBtn);
    }
    return { cutBtn, copyBtn, pasteBtn };
  }

  function hide() { menu.style.display = 'none'; }

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const { cutBtn, copyBtn, pasteBtn } = renderMenu();
    const sel = window.getSelection()?.toString() ?? '';
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const isEditable = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable);
    cutBtn.disabled  = !(isEditable && sel.length > 0);
    copyBtn.disabled = sel.length === 0;

    cutBtn.addEventListener('click',  () => { document.execCommand('cut');  hide(); });
    copyBtn.addEventListener('click', () => { document.execCommand('copy'); hide(); });
    pasteBtn.addEventListener('click', async () => {
      hide();
      try {
        const text = await navigator.clipboard.readText();
        if (isEditable && active) {
          const s = active.selectionStart ?? active.value.length;
          const end = active.selectionEnd ?? active.value.length;
          active.value = active.value.slice(0, s) + text + active.value.slice(end);
          active.selectionStart = active.selectionEnd = s + text.length;
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch { /* clipboard access denied */ }
    });

    const x = Math.min(e.clientX, window.innerWidth  - 145);
    const y = Math.min(e.clientY, window.innerHeight - 110);
    menu.style.left    = x + 'px';
    menu.style.top     = y + 'px';
    menu.style.display = 'block';
  });

  document.addEventListener('click',   hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
})();

let _lastBtnRect: DOMRect | null = null;
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button, label[class*="btn"]') as HTMLElement | null;
  if (btn) _lastBtnRect = btn.getBoundingClientRect();
}, true);

function showSaveIndicator(): void {
  const el = document.getElementById('save-indicator') as HTMLElement | null;
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth;
  const w = el.offsetWidth || 160, h = el.offsetHeight || 44;
  if (_lastBtnRect) {
    const r = _lastBtnRect;
    let x = r.right + 8;
    let y = r.top + r.height / 2 - h / 2;
    if (x + w > window.innerWidth - 8) x = r.left - w - 8;
    x = Math.max(x, 8);
    y = Math.min(Math.max(y, 8), window.innerHeight - h - 8);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  } else {
    el.style.right = '16px';
    el.style.bottom = '16px';
    el.style.left = 'auto';
    el.style.top = 'auto';
  }
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 900);
}

// ─── Export / Import ────────────────────────────────────────────────────────

async function exportJSON(): Promise<void> {
  const savedTagColors = localStorage.getItem('tagColors');
  const data: AppData = {
    steamMinutes,
    sessions,
    ownedMaps: profile.maps ?? [],
    ownedModules: profile.modules ?? [],
    ...(profile.exportProfile ? { profile } : {}),
    ...(savedTagColors ? { tagColors: JSON.parse(savedTagColors) } : {}),
  };
  const json = JSON.stringify(data, null, 2);
  const options: DialogSaveOptions = {
    defaultPath: 'export_dcs_flight_log.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const filePath = await window.__TAURI_INTERNALS__.invoke<string | null>(
    'plugin:dialog|save',
    { options }
  );
  if (filePath) {
    await invoke('save_file', { path: filePath, content: json });
  }
}

function importJSON(): void {
  document.getElementById('file-input')?.click();
}

function loadFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data: AppData = JSON.parse((e.target as FileReader).result as string);
      steamMinutes = data.steamMinutes ?? 0;
      sessions = data.sessions ?? [];
      if (data.profile && profile.importProfile) {
        profile = { ...data.profile, importProfile: profile.importProfile, exportProfile: profile.exportProfile, importMapsModules: profile.importMapsModules };
        if (!profile.maps) profile.maps = [];
        if (!profile.modules) profile.modules = [];
      }
      if (profile.importMapsModules) {
        const srcMaps = data.ownedMaps ?? data.profile?.maps;
        const srcModules = data.ownedModules ?? data.profile?.modules;
        if (srcMaps) profile.maps = srcMaps;
        if (srcModules) profile.modules = srcModules;
      }
      if ((data.profile && profile.importProfile) || profile.importMapsModules) {
        updateProfileBtn();
        const pfPage = document.getElementById('profile-page');
        if (pfPage && pfPage.style.display !== 'none') {
          if (profileEditing) editProfile(); else renderProfileView();
        }
      }
      if (profile.importTagColors && data.tagColors) {
        localStorage.setItem('tagColors', JSON.stringify(data.tagColors));
        _liveTagColors = loadTagColors();
        applyTagColors();
      }
      await saveToFile();
      updateSteamDisplay();
      updateTotal();
      renderSessions();
    } catch {
      alert(t('error_invalid_json'));
    }
  };
  reader.readAsText(file);
}

// ─── Steam ─────────────────────────────────────────────────────────────────

function updateSteamDisplay(): void {
  const el = document.getElementById('steam-display');
  if (el) el.textContent = minsToHM(steamMinutes);
}

function toggleSteamEdit(): void {
  const row = document.getElementById('steam-input-row') as HTMLElement;
  if (row.style.display === 'flex') { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  (document.getElementById('steam-h-inp') as HTMLInputElement).value = String(Math.floor(steamMinutes / 60));
  (document.getElementById('steam-m-inp') as HTMLInputElement).value = String(steamMinutes % 60);
}

async function saveSteam(): Promise<void> {
  steamMinutes =
    (parseInt((document.getElementById('steam-h-inp') as HTMLInputElement).value) || 0) * 60 +
    (parseInt((document.getElementById('steam-m-inp') as HTMLInputElement).value) || 0);
  (document.getElementById('steam-input-row') as HTMLElement).style.display = 'none';
  updateSteamDisplay();
  updateTotal();
  await saveToFile();
}

// ─── Total ─────────────────────────────────────────────────────────────────

function totalSAMin(): number { return sessions.reduce((a, s) => a + (s.durationMin || 0), 0); }
function updateTotal(): void {
  const el = document.getElementById('total-hours');
  if (el) el.textContent = minsToHM(steamMinutes + totalSAMin());
}

// ─── Session ON/OFF ────────────────────────────────────────────────────────

function syncTrayLabels(): void {
  const session = activeStart ? t('tray_menu_stop') : t('tray_menu_start');
  invoke('set_tray_labels', { session, quit: t('tray_menu_quit') }).catch(() => {});
}

function toggleSession(): void {
  const btn = document.getElementById('btn-toggle') as HTMLButtonElement;
  if (!activeStart) {
    activeStart = new Date();
    btn.textContent = t('session_stop');
    btn.classList.add('active');
    const siLabel = document.getElementById('si-label');
    const siTime = document.getElementById('si-time');
    if (siLabel) siLabel.textContent = t('session_active');
    if (siTime) siTime.textContent = fmtDate(activeStart) + ' — ' + fmtTime(activeStart);
    elapsedInterval = window.setInterval(updateElapsed, 1000);
    updateElapsed();
    syncTrayLabels();
  } else {
    const end = new Date();
    if (elapsedInterval !== null) clearInterval(elapsedInterval);
    pendingSession = {
      id: Date.now(),
      startTs: activeStart.getTime(),
      endTs: end.getTime(),
      durationMin: (end.getTime() - activeStart.getTime()) / 60000,
    };
    activeStart = null;
    btn.textContent = t('session_start');
    btn.classList.remove('active');
    const siLabel = document.getElementById('si-label');
    const siTime = document.getElementById('si-time');
    const siElapsed = document.getElementById('si-elapsed');
    if (siLabel) siLabel.textContent = t('session_waiting');
    if (siTime) siTime.textContent = '--:--:--';
    if (siElapsed) siElapsed.textContent = '';
    syncTrayLabels();
    openDebrief();
  }
}

function openDebrief(): void {
  if (!pendingSession) return;
  const num = sessions.length + 1;
  (document.getElementById('debrief-num') as HTMLElement).textContent = t('debrief_flight_num', { num: pad(num) });
  (document.getElementById('debrief-dur') as HTMLElement).textContent = durLabel(pendingSession.durationMin);
  const tStart = new Date(pendingSession.startTs);
  const tEnd   = new Date(pendingSession.endTs);
  const timesEl = document.getElementById('debrief-times');
  if (timesEl) timesEl.textContent = fmtDate(tStart) + '  •  ' + pad(tStart.getHours()) + ':' + pad(tStart.getMinutes()) + ' → ' + pad(tEnd.getHours()) + ':' + pad(tEnd.getMinutes());
  (document.getElementById('debrief-name') as HTMLInputElement).value = '';
  (document.getElementById('debrief-notes') as HTMLTextAreaElement).value = '';
  const picker = document.getElementById('debrief-aircraft-picker');
  if (picker) picker.innerHTML = renderAircraftPickerExpandable('debrief', []);
  const mapPicker = document.getElementById('debrief-map-picker');
  if (mapPicker) mapPicker.innerHTML = renderMapPickerExpandable('debrief', []);
  const mwrap = document.getElementById('debrief-mission-picker-wrap');
  if (mwrap) mwrap.innerHTML = renderMissionPickerHtml(0, []);
  document.getElementById('debrief-overlay')!.classList.add('open');
  setTimeout(() => (document.getElementById('debrief-name') as HTMLInputElement).focus(), 50);
}

async function confirmDebrief(): Promise<void> {
  if (!pendingSession) return;
  pendingSession.name  = (document.getElementById('debrief-name') as HTMLInputElement).value.trim() || undefined;
  pendingSession.notes = (document.getElementById('debrief-notes') as HTMLTextAreaElement).value.trim() || undefined;
  pendingSession.aircraft = Array.from(document.querySelectorAll<HTMLElement>('#aircraft-panel-debrief .mission-chip.selected')).map(el => el.dataset.aircraft!).filter(Boolean);
  if (!pendingSession.aircraft.length) pendingSession.aircraft = undefined;
  const debriefMaps = Array.from(document.querySelectorAll<HTMLElement>('#map-panel-debrief .mission-chip.selected')).map(el => el.dataset.map!).filter(Boolean);
  pendingSession.maps = debriefMaps.length ? debriefMaps : undefined;
  const mt = Array.from(document.querySelectorAll<HTMLElement>('#emission-tags-0 [data-mission]')).map(el => el.dataset.mission!).filter(Boolean);
  pendingSession.missionTypes = mt.length ? mt : undefined;
  sessions.unshift(pendingSession);
  pendingSession = null;
  document.getElementById('debrief-overlay')!.classList.remove('open');
  renderSessions(); updateTotal(); await saveToFile();
}

async function skipDebrief(): Promise<void> {
  if (!pendingSession) return;
  sessions.unshift(pendingSession);
  pendingSession = null;
  document.getElementById('debrief-overlay')!.classList.remove('open');
  renderSessions(); updateTotal(); await saveToFile();
}

function deleteDebrief(): void {
  pendingSession = null;
  document.getElementById('debrief-overlay')!.classList.remove('open');
}

function updateElapsed(): void {
  if (!activeStart) return;
  const el = document.getElementById('si-elapsed');
  if (el) el.textContent = '⏱ ' + secsToHMS(Math.floor((Date.now() - activeStart.getTime()) / 1000));
  syncBurgerState();
}

// ─── Édition ───────────────────────────────────────────────────────────────

function calcEditDur(id: number): EditResult | null {
  const dv1 = (document.getElementById('edate1-' + id) as HTMLInputElement).value;
  const dv2 = (document.getElementById('edate2-' + id) as HTMLInputElement).value;
  const h1 = parseInt((document.getElementById('eh1-' + id) as HTMLInputElement).value) || 0;
  const m1 = parseInt((document.getElementById('em1-' + id) as HTMLInputElement).value) || 0;
  const h2 = parseInt((document.getElementById('eh2-' + id) as HTMLInputElement).value) || 0;
  const m2 = parseInt((document.getElementById('em2-' + id) as HTMLInputElement).value) || 0;
  if (!dv1 || !dv2) return null;
  const start = new Date(dv1 + 'T' + pad(h1) + ':' + pad(m1));
  const end = new Date(dv2 + 'T' + pad(h2) + ':' + pad(m2));
  const dur = (end.getTime() - start.getTime()) / 60000;
  if (dur <= 0) return null;
  return { start, end, dur };
}

function updateEditResult(id: number): void {
  const res = calcEditDur(id);
  const el = document.getElementById('res-dur-' + id);
  if (el) el.textContent = res ? durLabel(res.dur) : '--';
}

// ─── Rendu sessions ────────────────────────────────────────────────────────

function renderSessions(): void {
  const list = document.getElementById('sessions-list') as HTMLElement;
  const sc = document.getElementById('session-count') as HTMLElement;
  const query = ((document.getElementById('search-input') as HTMLInputElement)?.value ?? '').trim().toLowerCase();

  if (!sessions.length) {
    list.innerHTML = `<div id="empty-msg">${t('history_empty')} <span id="blink">_</span></div>`;
    sc.textContent = '';
    return;
  }

  const numbered = sessions.map((s, i) => ({ s, num: sessions.length - i }));
  const filtered = query
    ? numbered.filter(({ s, num }) => {
        const q = query.replace(/^#/, '');
        return String(num).includes(q)
          || (s.name?.toLowerCase().includes(query) ?? false)
          || (s.notes?.toLowerCase().includes(query) ?? false)
          || (s.aircraft?.some(a => a.toLowerCase().includes(query)) ?? false)
          || (s.missionTypes?.some(mt => mt.toLowerCase().includes(query)) ?? false)
          || (s.maps?.some(m => {
               const mp = DCS_MAPS.find(d => d.name === m);
               return m.toLowerCase().includes(query)
                 || (mp ? tAll(mp.key).some(tr => tr.includes(query)) : false);
             }) ?? false);
      })
    : numbered;

  const displayCount = query ? filtered.length : sessions.length;
  const displayDur   = query ? filtered.reduce((a, { s }) => a + (s.durationMin || 0), 0) : totalSAMin();
  sc.textContent = t('history_count', { count: displayCount, duration: minsToHM(displayDur) });

  if (!filtered.length) {
    list.innerHTML = `<div id="empty-msg">${t('history_no_results')}</div>`;
    return;
  }

  list.innerHTML = filtered.map(({ s, num }) => {
    const start = new Date(s.startTs);
    const end   = new Date(s.endTs);
    const nameLine     = s.name  ? `<div class="s-name">${escapeHtml(s.name)}</div>` : '';
    const notesBadge   = s.notes ? `<div class="row s-note-badge">${t('card_notes_badge')}</div>` : '';
    const aircraftRow  = s.aircraft?.length ? `<div class="s-aircraft-row">${s.aircraft.map(a => `<span class="s-aircraft-tag" data-aircraft="${escapeHtml(a)}">${escapeHtml(a)}</span>`).join('')}</div>` : '';
    const missionRow   = s.missionTypes?.length ? `<div class="s-aircraft-row">${s.missionTypes.map(mt => `<span class="s-mission-tag" data-mission="${escapeHtml(mt)}">${escapeHtml(mt)}</span>`).join('')}</div>` : '';
    const mapRow       = s.maps?.length ? `<div class="s-aircraft-row">${s.maps.map(m => { const mp = DCS_MAPS.find(d => d.name === m); return `<span class="s-map-tag" data-map="${escapeHtml(m)}">${escapeHtml(mp ? t(mp.key) : m)}</span>`; }).join('')}</div>` : '';

    const notesFull    = s.notes
      ? `<div class="s-notes-full">${escapeHtml(s.notes).replace(/\n/g, '<br>')}</div>`
      : `<div class="s-notes-empty">${t('card_no_notes')}</div>`;
    return `<div class="session-card" id="sc-${s.id}">
      <div class="card-header" onclick="toggleCard(${s.id})">
        <div class="s-num">#${pad(num)}</div>
        <div class="s-times">
          ${nameLine}
          <div class="row">${t('card_start')}&nbsp;<span>${fmtDate(start)} ${pad(start.getHours())}:${pad(start.getMinutes())}</span></div>
          <div class="row">${t('card_end')}&nbsp;<span>${fmtDate(end)} ${pad(end.getHours())}:${pad(end.getMinutes())}</span></div>
          ${notesBadge}
          ${missionRow}
          ${mapRow}
          ${aircraftRow}
        </div>
        <div class="s-dur">${durLabel(s.durationMin)}</div>
        <button class="btn-icon" onclick="event.stopPropagation();toggleEdit(${s.id})" title="${t('card_edit_tooltip')}"><img src="./icons/pencil.png" width="16" height="16"></button>
        <button class="btn-icon btn-icon-danger" onclick="event.stopPropagation();deleteSession(${s.id})" title="${t('card_delete_tooltip')}"><img src="./icons/trash.png" width="16" height="16"></button>
      </div>
      <div class="s-details" id="details-${s.id}">
        ${notesFull}
      </div>
      <div class="edit-row" id="edit-${s.id}" onclick="event.stopPropagation()">
        <div class="edit-block">
          <div class="edit-block-label">${t('edit_start')}</div>
          <div class="edit-fields-row">
            <div class="ef-group"><label>${t('edit_day')}</label><input type="date" id="edate1-${s.id}" value="${fmtDateInput(start)}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-sep">—</div>
            <div class="ef-group"><label>${t('edit_h')}</label><input type="number" id="eh1-${s.id}" min="0" max="23" value="${start.getHours()}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-group"><label>${t('edit_min')}</label><input type="number" id="em1-${s.id}" min="0" max="59" value="${start.getMinutes()}" oninput="updateEditResult(${s.id})"></div>
          </div>
        </div>
        <div class="edit-block">
          <div class="edit-block-label">${t('edit_end')}</div>
          <div class="edit-fields-row">
            <div class="ef-group"><label>${t('edit_day')}</label><input type="date" id="edate2-${s.id}" value="${fmtDateInput(end)}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-sep">—</div>
            <div class="ef-group"><label>${t('edit_h')}</label><input type="number" id="eh2-${s.id}" min="0" max="23" value="${end.getHours()}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-group"><label>${t('edit_min')}</label><input type="number" id="em2-${s.id}" min="0" max="59" value="${end.getMinutes()}" oninput="updateEditResult(${s.id})"></div>
          </div>
        </div>
        <div class="notes-group">
          <label class="edit-block-label">${t('edit_name')}</label>
          <input type="text" id="ename-${s.id}" class="debrief-input" style="width:100%" placeholder="${t('edit_name_placeholder')}" value="${escapeHtml(s.name || '')}">
        </div>
        <div class="notes-group">
          <label class="edit-block-label">${t('edit_mission_types')}</label>
          <div class="mission-picker-wrap">${renderMissionPickerHtml(s.id, s.missionTypes ?? [])}</div>
        </div>
        <div class="notes-group">
          <label class="edit-block-label">${t('edit_map')}</label>
          <div id="emap-${s.id}">${renderMapPickerExpandable(String(s.id), s.maps ?? [])}</div>
        </div>
        <div class="notes-group">
          <label class="edit-block-label">${t('edit_aircraft')}</label>
          <div id="eaircraft-${s.id}">${renderAircraftPickerExpandable(String(s.id), s.aircraft ?? [])}</div>
        </div>
        <div class="notes-group">
          <label class="edit-block-label">${t('edit_notes')}</label>
          <textarea id="enotes-${s.id}" class="notes-textarea" placeholder="${t('edit_notes_placeholder')}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${escapeHtml(s.notes || '')}</textarea>
        </div>
        <div class="edit-actions">
          <button class="btn-sm" onclick="saveEdit(${s.id})">${t('edit_save')}</button>
          <button class="btn-sm btn-cancel" onclick="cancelEdit(${s.id})">${t('edit_cancel')}</button>
          <button class="btn-danger" onclick="deleteSession(${s.id})">${t('edit_delete')}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleCard(id: number): void {
  const card    = document.getElementById('sc-' + id) as HTMLElement;
  const isOpen  = card.classList.contains('expanded');
  if (isOpen && checkCardEditing(() => toggleCard(id))) return;
  const details = document.getElementById('details-' + id) as HTMLElement;
  const editRow = document.getElementById('edit-' + id) as HTMLElement;
  if (isOpen) {
    card.classList.remove('expanded', 'editing');
    details.style.display = 'none';
    editRow.style.display = 'none';
  } else {
    card.classList.add('expanded');
    details.style.display = 'block';
  }
}

function toggleEdit(id: number): void {
  if (editingCardId !== null && editingCardId !== id) {
    checkCardEditing(() => toggleEdit(id));
    return;
  }
  const row  = document.getElementById('edit-' + id) as HTMLElement;
  const card = document.getElementById('sc-' + id) as HTMLElement;
  if (row.style.display === 'flex') {
    row.style.display = 'none';
    card.classList.remove('editing');
    editingCardId = null;
  } else {
    card.classList.add('expanded', 'editing');
    (document.getElementById('details-' + id) as HTMLElement).style.display = 'none';
    row.style.display = 'flex';
    editingCardId = id;
    setTimeout(() => {
      const ta = document.getElementById('enotes-' + id) as HTMLTextAreaElement;
      if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
    }, 0);
  }
}
function cancelEdit(id: number): void {
  if (editingCardId === id) editingCardId = null;
  renderSessions();
}
async function saveEdit(id: number): Promise<void> {
  const res = calcEditDur(id); if (!res) return;
  const idx = sessions.findIndex(s => s.id === id); if (idx < 0) return;
  sessions[idx].startTs = res.start.getTime();
  sessions[idx].endTs = res.end.getTime();
  sessions[idx].durationMin = res.dur;
  sessions[idx].name  = (document.getElementById('ename-'  + id) as HTMLInputElement).value.trim() || undefined;
  sessions[idx].notes = (document.getElementById('enotes-' + id) as HTMLTextAreaElement).value.trim() || undefined;
  const ac = Array.from(document.querySelectorAll<HTMLElement>(`#aircraft-panel-${id} .mission-chip.selected`)).map(el => el.dataset.aircraft!).filter(Boolean);
  sessions[idx].aircraft = ac.length ? ac : undefined;
  const editMaps = Array.from(document.querySelectorAll<HTMLElement>(`#map-panel-${id} .mission-chip.selected`)).map(el => el.dataset.map!).filter(Boolean);
  sessions[idx].maps = editMaps.length ? editMaps : undefined;
  const mt = Array.from(document.querySelectorAll<HTMLElement>(`#emission-tags-${id} [data-mission]`)).map(el => el.dataset.mission!).filter(Boolean);
  sessions[idx].missionTypes = mt.length ? mt : undefined;
  if (editingCardId === id) editingCardId = null;
  renderSessions(); updateTotal(); await saveToFile();
}
async function deleteSession(id: number): Promise<void> {
  sessions = sessions.filter(s => s.id !== id);
  renderSessions(); updateTotal(); await saveToFile();
}

function getCardChanges(id: number): string[] {
  const session = sessions.find(s => s.id === id);
  if (!session) return [];
  const changes: string[] = [];
  const name = (document.getElementById('ename-' + id) as HTMLInputElement)?.value.trim() || undefined;
  if (name !== (session.name || undefined)) changes.push(t('change_name', { from: session.name || '—', to: name || '—' }));
  const notes = (document.getElementById('enotes-' + id) as HTMLTextAreaElement)?.value.trim() || undefined;
  if (notes !== (session.notes || undefined)) changes.push(t('change_comment'));
  const ac = Array.from(document.querySelectorAll<HTMLElement>(`#aircraft-panel-${id} .mission-chip.selected`)).map(el => el.dataset.aircraft!).filter(Boolean);
  const savedAc = session.aircraft || [];
  const acAdd = ac.filter(a => !savedAc.includes(a)), acRem = savedAc.filter(a => !ac.includes(a));
  if (acAdd.length) changes.push(t('change_aircraft_added', { list: acAdd.join(', ') }));
  if (acRem.length) changes.push(t('change_aircraft_removed', { list: acRem.join(', ') }));
  const cardMaps = Array.from(document.querySelectorAll<HTMLElement>(`#map-panel-${id} .mission-chip.selected`)).map(el => el.dataset.map!).filter(Boolean);
  const savedCardMaps = session.maps || [];
  const mapsAdd = cardMaps.filter(m => !savedCardMaps.includes(m)), mapsRem = savedCardMaps.filter(m => !cardMaps.includes(m));
  if (mapsAdd.length) changes.push(t('change_maps_added', { list: mapsAdd.map(m => { const mp = DCS_MAPS.find(d => d.name === m); return mp ? t(mp.key) : m; }).join(', ') }));
  if (mapsRem.length) changes.push(t('change_maps_removed', { list: mapsRem.map(m => { const mp = DCS_MAPS.find(d => d.name === m); return mp ? t(mp.key) : m; }).join(', ') }));
  const mt = Array.from(document.querySelectorAll<HTMLElement>(`#emission-tags-${id} [data-mission]`)).map(el => el.dataset.mission!).filter(Boolean);
  const savedMt = session.missionTypes || [];
  const mtAdd = mt.filter(t2 => !savedMt.includes(t2)), mtRem = savedMt.filter(t2 => !mt.includes(t2));
  if (mtAdd.length) changes.push(t('change_mission_added', { list: mtAdd.join(', ') }));
  if (mtRem.length) changes.push(t('change_mission_removed', { list: mtRem.join(', ') }));
  const res = calcEditDur(id);
  if (res && (Math.abs(res.start.getTime() - session.startTs) > 59000 || Math.abs(res.end.getTime() - session.endTs) > 59000)) changes.push(t('change_times'));
  return changes;
}

function checkCardEditing(nav: () => void): boolean {
  if (editingCardId === null) return false;
  const row = document.getElementById('edit-' + editingCardId);
  if (!row || row.style.display === 'none') { editingCardId = null; return false; }
  const changes = getCardChanges(editingCardId);
  if (_tagColorsDirty) changes.push(t('change_tag_colors'));
  if (!changes.length) { cancelEdit(editingCardId); return false; }
  pendingCardNav = nav;
  const num = pad(sessions.findIndex(s => s.id === editingCardId) >= 0 ? sessions.length - sessions.findIndex(s => s.id === editingCardId) : 0);
  const msg = document.getElementById('card-confirm-msg')!;
  msg.innerHTML = t('confirm_card', { num, changes: changes.join('<br>') });
  (document.getElementById('card-confirm-overlay') as HTMLElement).style.display = 'flex';
  return true;
}

function confirmCardLeave(save: boolean | null): void {
  (document.getElementById('card-confirm-overlay') as HTMLElement).style.display = 'none';
  if (save === null) { pendingCardNav = null; return; }
  const id = editingCardId;
  if (id === null) { pendingCardNav = null; return; }
  editingCardId = null;
  if (save) {
    saveEdit(id);
    if (_tagColorsDirty) saveTagColorsManual();
  } else {
    cancelEdit(id);
    if (_tagColorsDirty) {
      closeTagColorPopup();
      closeTagEditor();
      _liveTagColors = loadTagColors();
      _tagColorsDirty = false;
      _updateCustSaveBtn();
      applyTagColors();
    }
  }
  const nav = pendingCardNav;
  pendingCardNav = null;
  if (nav) nav();
}

// ─── Profil ────────────────────────────────────────────────────────────────

function updateProfileBtn(): void {
  const btn = document.getElementById('profile-btn');
  if (!btn) return;
  const src = profile.avatar
    ? profile.avatar
    : (() => { const svg = boringAvatar(profile.name || 'pilot', 32); return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); })();
  btn.innerHTML = `<img src="${src}" alt="profil" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
}

function hidAllPages(): void {
  (document.getElementById('log-page')      as HTMLElement).style.display = 'none';
  (document.getElementById('profile-page')  as HTMLElement).style.display = 'none';
  (document.getElementById('new-flight-page') as HTMLElement).style.display = 'none';
  (document.getElementById('settings-page') as HTMLElement).style.display = 'none';
  ['nav-historique','nav-new-flight','nav-settings','burger-historique','burger-new-flight','burger-settings'].forEach(id => document.getElementById(id)?.classList.remove('active'));
  document.getElementById('profile-btn')?.classList.remove('active');
}

function showProfile(): void {
  if (checkCardEditing(() => showProfile())) return;
  if (checkNewFlight(() => showProfile())) return;
  if (checkSettingsDirty(() => showProfile())) return;
  if (checkTagColorsDirty(() => showProfile())) return;
  hidAllPages();
  (document.getElementById('profile-page') as HTMLElement).style.display = 'flex';
  document.getElementById('profile-btn')?.classList.add('active');
  renderProfileView();
}

function hideProfile(): void {
  showHistorique();
}

function showHistorique(): void {
  if (checkNewFlight(() => showHistorique())) return;
  if (checkProfileEditing(() => showHistorique())) return;
  if (checkSettingsDirty(() => showHistorique())) return;
  if (checkTagColorsDirty(() => showHistorique())) return;
  hidAllPages();
  (document.getElementById('log-page') as HTMLElement).style.display = '';
  document.getElementById('nav-historique')?.classList.add('active');
  document.getElementById('burger-historique')?.classList.add('active');
  closeBurger();
}

function showSettings(): void {
  if (checkCardEditing(() => showSettings())) return;
  if (checkNewFlight(() => showSettings())) return;
  if (checkProfileEditing(() => showSettings())) return;
  if (checkSettingsDirty(() => showSettings())) return;
  if (checkTagColorsDirty(() => showSettings())) return;
  hidAllPages();
  (document.getElementById('settings-page') as HTMLElement).style.display = 'flex';
  document.getElementById('nav-settings')?.classList.add('active');
  document.getElementById('burger-settings')?.classList.add('active');
  const expCb = document.getElementById('st-export-profile') as HTMLInputElement;
  const impCb = document.getElementById('st-import-profile') as HTMLInputElement;
  if (expCb) expCb.checked = !!profile.exportProfile;
  if (impCb) impCb.checked = !!profile.importProfile;
  const impMMCb = document.getElementById('st-import-maps-modules') as HTMLInputElement;
  if (impMMCb) impMMCb.checked = !!profile.importMapsModules;
  const impTCCb = document.getElementById('st-import-tag-colors') as HTMLInputElement;
  if (impTCCb) impTCCb.checked = !!profile.importTagColors;
  settingsDirty = false;
}

function onSettingChange(): void {
  settingsDirty = true;
  (document.getElementById('st-action-btns') as HTMLElement).style.display = '';
}

function saveSettings(): void {
  profile.exportProfile = (document.getElementById('st-export-profile') as HTMLInputElement).checked;
  profile.importProfile = (document.getElementById('st-import-profile') as HTMLInputElement).checked;
  profile.importMapsModules = (document.getElementById('st-import-maps-modules') as HTMLInputElement).checked;
  profile.importTagColors = (document.getElementById('st-import-tag-colors') as HTMLInputElement).checked;
  settingsDirty = false;
  (document.getElementById('st-action-btns') as HTMLElement).style.display = 'none';
  saveToFile();
}

function cancelSettings(): void {
  (document.getElementById('st-export-profile') as HTMLInputElement).checked = !!profile.exportProfile;
  (document.getElementById('st-import-profile') as HTMLInputElement).checked = !!profile.importProfile;
  (document.getElementById('st-import-maps-modules') as HTMLInputElement).checked = !!profile.importMapsModules;
  (document.getElementById('st-import-tag-colors') as HTMLInputElement).checked = !!profile.importTagColors;
  settingsDirty = false;
  (document.getElementById('st-action-btns') as HTMLElement).style.display = 'none';
}

function getSettingsChanges(): string[] {
  const changes: string[] = [];
  const exp = (document.getElementById('st-export-profile') as HTMLInputElement)?.checked;
  const imp = (document.getElementById('st-import-profile') as HTMLInputElement)?.checked;
  const impMM = (document.getElementById('st-import-maps-modules') as HTMLInputElement)?.checked;
  const impTC = (document.getElementById('st-import-tag-colors') as HTMLInputElement)?.checked;
  if (exp !== !!profile.exportProfile) changes.push(t('change_setting_export', { state: exp ? t('change_enabled') : t('change_disabled') }));
  if (imp !== !!profile.importProfile) changes.push(t('change_setting_import', { state: imp ? t('change_enabled') : t('change_disabled') }));
  if (impMM !== !!profile.importMapsModules) changes.push(t('change_setting_maps_modules', { state: impMM ? t('change_enabled') : t('change_disabled') }));
  if (impTC !== !!profile.importTagColors) changes.push(t('change_setting_tag_colors', { state: impTC ? t('change_enabled') : t('change_disabled') }));
  return changes;
}

function getProfileChanges(): string[] {
  const changes: string[] = [];
  const nameEl = document.getElementById('pf-name-input') as HTMLInputElement | null;
  if (nameEl && nameEl.value.trim() !== profile.name) changes.push(t('change_name', { from: profile.name || '—', to: nameEl.value.trim() || '—' }));
  const selected = new Set(Array.from(document.querySelectorAll<HTMLElement>('.pf-module-toggle.selected')).map(el => el.dataset.module!).filter(Boolean));
  const saved = new Set(profile.modules);
  const added = [...selected].filter(m => !saved.has(m));
  const removed = [...saved].filter(m => !selected.has(m));
  if (added.length) changes.push(t('change_modules_added', { list: added.join(', ') }));
  if (removed.length) changes.push(t('change_modules_removed', { list: removed.join(', ') }));
  const selMaps = new Set(Array.from(document.querySelectorAll<HTMLElement>('.pf-map-toggle.selected')).map(el => el.dataset.map!).filter(Boolean));
  const savedMaps = new Set(profile.maps);
  const mapsAdded = [...selMaps].filter(m => !savedMaps.has(m));
  const mapsRemoved = [...savedMaps].filter(m => !selMaps.has(m));
  if (mapsAdded.length) changes.push(t('change_maps_added', { list: mapsAdded.join(', ') }));
  if (mapsRemoved.length) changes.push(t('change_maps_removed', { list: mapsRemoved.join(', ') }));
  return changes;
}

function checkProfileEditing(_nav: () => void): boolean {
  if (!profileEditing || (document.getElementById('profile-page') as HTMLElement).style.display === 'none') return false;
  const changes = getProfileChanges();
  if (!changes.length) { cancelEditProfile(); return false; }
  const msg = document.getElementById('pf-confirm-msg')!;
  msg.innerHTML = t('confirm_profile', { changes: changes.join('<br>') });
  (document.getElementById('pf-confirm-overlay') as HTMLElement).style.display = 'flex';
  return true;
}

function confirmProfileLeave(save: boolean | null): void {
  (document.getElementById('pf-confirm-overlay') as HTMLElement).style.display = 'none';
  if (save === null) return;
  if (save) saveProfile(); else cancelEditProfile();
}

function isNewFlightDirty(): boolean {
  const name  = (document.getElementById('nf-name')  as HTMLInputElement)?.value.trim();
  const notes = (document.getElementById('nf-notes') as HTMLTextAreaElement)?.value.trim();
  const ac = document.querySelectorAll('#aircraft-panel-nf .mission-chip.selected').length;
  const mt = document.querySelectorAll('#emission-tags--1 [data-mission]').length;
  const maps = document.querySelectorAll('#map-panel-nf .mission-chip.selected').length;
  return !!(name || notes || ac || mt || maps);
}

function getNewFlightChanges(): string[] {
  const changes: string[] = [];
  const name = (document.getElementById('nf-name') as HTMLInputElement)?.value.trim();
  if (name) changes.push(t('change_flight_name', { name }));
  const mt = Array.from(document.querySelectorAll<HTMLElement>('#emission-tags--1 [data-mission]')).map(el => el.dataset.mission!).filter(Boolean);
  if (mt.length) changes.push(t('change_missions', { list: mt.join(', ') }));
  const ac = Array.from(document.querySelectorAll<HTMLElement>('#aircraft-panel-nf .mission-chip.selected')).map(el => el.dataset.aircraft!).filter(Boolean);
  if (ac.length) changes.push(t('change_aircraft', { list: ac.join(', ') }));
  const nfMaps = Array.from(document.querySelectorAll<HTMLElement>('#map-panel-nf .mission-chip.selected')).map(el => el.dataset.map!).filter(Boolean);
  if (nfMaps.length) changes.push(t('change_maps_added', { list: nfMaps.map(m => { const mp = DCS_MAPS.find(d => d.name === m); return mp ? t(mp.key) : m; }).join(', ') }));
  const notes = (document.getElementById('nf-notes') as HTMLTextAreaElement)?.value.trim();
  if (notes) changes.push(t('change_comment_filled'));
  return changes;
}

function checkNewFlight(nav: () => void): boolean {
  const page = document.getElementById('new-flight-page') as HTMLElement;
  if (!page || page.style.display === 'none') return false;
  if (!isNewFlightDirty()) return false;
  pendingNewFlightNav = nav;
  const changes = getNewFlightChanges();
  const msg = document.getElementById('nf-confirm-msg')!;
  msg.innerHTML = changes.length
    ? t('confirm_new_flight_changes', { changes: changes.join('<br>') })
    : t('confirm_new_flight_unsaved');
  (document.getElementById('nf-confirm-overlay') as HTMLElement).style.display = 'flex';
  return true;
}

function confirmNewFlightLeave(save: boolean | null): void {
  (document.getElementById('nf-confirm-overlay') as HTMLElement).style.display = 'none';
  if (save === null) { pendingNewFlightNav = null; return; }
  if (save) { saveNewFlight(); pendingNewFlightNav = null; return; }
  const nav = pendingNewFlightNav;
  pendingNewFlightNav = null;
  showNewFlight();
  if (nav) nav();
}

function checkSettingsDirty(_nav: () => void): boolean {
  if (!settingsDirty || (document.getElementById('settings-page') as HTMLElement).style.display === 'none') return false;
  const changes = getSettingsChanges();
  const msg = document.getElementById('st-confirm-msg')!;
  msg.innerHTML = changes.length
    ? t('confirm_settings_changes', { changes: changes.join('<br>') })
    : t('confirm_settings_unsaved');
  (document.getElementById('st-confirm-overlay') as HTMLElement).style.display = 'flex';
  return true;
}

function confirmSettingsLeave(save: boolean | null): void {
  (document.getElementById('st-confirm-overlay') as HTMLElement).style.display = 'none';
  if (save === null) return;
  if (save) saveSettings(); else { closeTagColorPopup(); cancelSettings(); }
}

function checkTagColorsDirty(nav: () => void): boolean {
  if (!_tagColorsDirty) return false;
  _pendingTagColorNav = nav;
  const msg = document.getElementById('cust-confirm-msg')!;
  msg.innerHTML = t('confirm_tag_colors_unsaved');
  (document.getElementById('cust-confirm-overlay') as HTMLElement).style.display = 'flex';
  return true;
}

function confirmTagColorsLeave(save: boolean | null): void {
  (document.getElementById('cust-confirm-overlay') as HTMLElement).style.display = 'none';
  if (save === null) { _pendingTagColorNav = null; return; }
  if (save) {
    saveTagColorsManual();
  } else {
    closeTagEditor();
    _liveTagColors = loadTagColors();
    _tagColorsDirty = false;
    _updateCustSaveBtn();
    applyTagColors();
  }
  closeTagColorPopup();
  const nav = _pendingTagColorNav;
  _pendingTagColorNav = null;
  if (nav) nav();
}

function toggleSection(titleEl: HTMLElement): void {
  titleEl.closest('.st-section')?.classList.toggle('collapsed');
}

function cancelNewFlight(): void {
  if (checkProfileEditing(() => cancelNewFlight())) return;
  if (checkSettingsDirty(() => cancelNewFlight())) return;
  if (checkTagColorsDirty(() => cancelNewFlight())) return;
  hidAllPages();
  (document.getElementById('log-page') as HTMLElement).style.display = '';
  document.getElementById('burger-history')?.classList.add('active');
}

function showNewFlight(): void {
  if (checkCardEditing(() => showNewFlight())) return;
  if (checkProfileEditing(() => showNewFlight())) return;
  if (checkSettingsDirty(() => showNewFlight())) return;
  if (checkTagColorsDirty(() => showNewFlight())) return;
  hidAllPages();
  (document.getElementById('new-flight-page') as HTMLElement).style.display = 'flex';
  document.getElementById('nav-new-flight')?.classList.add('active');
  document.getElementById('burger-new-flight')?.classList.add('active');
  const today = fmtDateInput(new Date());
  (document.getElementById('nf-date1') as HTMLInputElement).value = today;
  (document.getElementById('nf-date2') as HTMLInputElement).value = today;
  (document.getElementById('nf-h1') as HTMLInputElement).value = '0';
  (document.getElementById('nf-m1') as HTMLInputElement).value = '0';
  (document.getElementById('nf-h2') as HTMLInputElement).value = '0';
  (document.getElementById('nf-m2') as HTMLInputElement).value = '0';
  (document.getElementById('nf-name') as HTMLInputElement).value = '';
  (document.getElementById('nf-notes') as HTMLTextAreaElement).value = '';
  const mwrap = document.getElementById('nf-mission-picker-wrap');
  if (mwrap) mwrap.innerHTML = renderMissionPickerHtml(-1, []);
  const apicker = document.getElementById('nf-aircraft-picker');
  if (apicker) apicker.innerHTML = renderAircraftPickerExpandable('nf', []);
  const mpicker = document.getElementById('nf-map-picker');
  if (mpicker) mpicker.innerHTML = renderMapPickerExpandable('nf', []);
  updateNewFlightResult();
}

function updateNewFlightResult(): void {
  const d1 = (document.getElementById('nf-date1') as HTMLInputElement).value;
  const d2 = (document.getElementById('nf-date2') as HTMLInputElement).value;
  const h1 = parseInt((document.getElementById('nf-h1') as HTMLInputElement).value) || 0;
  const m1 = parseInt((document.getElementById('nf-m1') as HTMLInputElement).value) || 0;
  const h2 = parseInt((document.getElementById('nf-h2') as HTMLInputElement).value) || 0;
  const m2 = parseInt((document.getElementById('nf-m2') as HTMLInputElement).value) || 0;
  const el = document.getElementById('nf-duration');
  if (!el) return;
  if (!d1 || !d2) { el.textContent = '—'; return; }
  const start = new Date(`${d1}T${pad(h1)}:${pad(m1)}:00`);
  const end   = new Date(`${d2}T${pad(h2)}:${pad(m2)}:00`);
  const dur   = Math.round((end.getTime() - start.getTime()) / 60000);
  el.textContent = dur > 0 ? durLabel(dur) : '—';
}

async function saveNewFlight(): Promise<void> {
  const d1 = (document.getElementById('nf-date1') as HTMLInputElement).value;
  const d2 = (document.getElementById('nf-date2') as HTMLInputElement).value;
  if (!d1 || !d2) return;
  const h1 = parseInt((document.getElementById('nf-h1') as HTMLInputElement).value) || 0;
  const m1 = parseInt((document.getElementById('nf-m1') as HTMLInputElement).value) || 0;
  const h2 = parseInt((document.getElementById('nf-h2') as HTMLInputElement).value) || 0;
  const m2 = parseInt((document.getElementById('nf-m2') as HTMLInputElement).value) || 0;
  const start = new Date(`${d1}T${pad(h1)}:${pad(m1)}:00`);
  const end   = new Date(`${d2}T${pad(h2)}:${pad(m2)}:00`);
  const dur   = Math.round((end.getTime() - start.getTime()) / 60000);
  if (dur <= 0) return;
  const name  = (document.getElementById('nf-name') as HTMLInputElement).value.trim() || undefined;
  const notes = (document.getElementById('nf-notes') as HTMLTextAreaElement).value.trim() || undefined;
  const ac = Array.from(document.querySelectorAll<HTMLElement>('#aircraft-panel-nf .mission-chip.selected')).map(el => el.dataset.aircraft!).filter(Boolean);
  const mt = Array.from(document.querySelectorAll<HTMLElement>('#emission-tags--1 [data-mission]')).map(el => el.dataset.mission!).filter(Boolean);
  const nfMapsSave = Array.from(document.querySelectorAll<HTMLElement>('#map-panel-nf .mission-chip.selected')).map(el => el.dataset.map!).filter(Boolean);
  const s: Session = {
    id: Date.now(),
    startTs: start.getTime(),
    endTs: end.getTime(),
    durationMin: dur,
    name,
    notes,
    aircraft: ac.length ? ac : undefined,
    missionTypes: mt.length ? mt : undefined,
    maps: nfMapsSave.length ? nfMapsSave : undefined,
  };
  sessions.unshift(s);
  renderSessions(); updateTotal(); await saveToFile();
  showNewFlight();
  const msg = document.getElementById('nf-save-msg');
  if (msg) { msg.style.opacity = '1'; setTimeout(() => msg.style.opacity = '0', 1500); }
}

function toggleBurger(): void {
  document.getElementById('burger-menu')?.classList.toggle('open');
  syncBurgerState();
}

function closeBurger(): void {
  document.getElementById('burger-menu')?.classList.remove('open');
}

function syncBurgerState(): void {
  const siLabel   = document.getElementById('si-label')?.textContent ?? '';
  const siTime    = document.getElementById('si-time')?.textContent ?? '';
  const siElapsed = document.getElementById('si-elapsed')?.textContent ?? '';
  const btnText   = (document.getElementById('btn-toggle') as HTMLButtonElement)?.textContent ?? '';
  const bLabel = document.getElementById('burger-si-label');
  const bTime  = document.getElementById('burger-si-time');
  const bElap  = document.getElementById('burger-si-elapsed');
  const bBtn   = document.getElementById('burger-btn-toggle');
  if (bLabel) bLabel.textContent = siLabel;
  if (bTime)  bTime.textContent  = siTime;
  if (bElap)  bElap.textContent  = siElapsed;
  if (bBtn)   bBtn.textContent   = btnText;
  const active = document.getElementById('btn-toggle')?.classList.contains('active');
  if (active) bBtn?.classList.add('active'); else bBtn?.classList.remove('active');
}

function syncBurgerSearch(): void {
  const val = (document.getElementById('burger-search') as HTMLInputElement).value;
  (document.getElementById('search-input') as HTMLInputElement).value = val;
  renderSessions();
}

function getEffectiveOwnedModuleNames(): Set<string> {
  const owned = new Set(profile.modules);
  DCS_MODULES.forEach(mod => {
    if (owned.has(mod.name) && mod.includes) mod.includes.forEach(inc => owned.add(inc));
  });
  return owned;
}

function missionTagHtml(id: number, type: string): string {
  const sk = escapeHtml(type);
  return `<span class="mission-tag" data-mission="${sk}">${sk}<button type="button" class="mission-tag-color" onclick="openTagColorPopup('${sk}',this)">${DROPPER_SVG}</button><button type="button" class="mission-tag-remove" onclick="removeMissionType(${id},'${sk}')"><img src="./icons/close.png" alt="×"></button></span>`;
}

function renderMissionPickerHtml(id: number, selected: string[]): string {
  const tags = selected.map(type => missionTagHtml(id, type)).join('');
  const chips = MISSION_TYPES.map(type => {
    const sel = selected.includes(type);
    return `<button type="button" class="mission-chip${sel ? ' selected' : ''}" onclick="toggleMissionType(${id},'${escapeHtml(type)}')" data-mission="${escapeHtml(type)}">${escapeHtml(type)}</button>`;
  }).join('');
  return `
    <div class="mission-picker-row">
      <div class="mission-tags-row" id="emission-tags-${id}">${tags}</div>
      <button type="button" class="mission-add-btn" onclick="toggleMissionPanel(${id})">+</button>
    </div>
    <div class="mission-panel" id="emission-panel-${id}">
      ${chips}
      <div class="mission-custom-row">
        <input type="text" class="mission-custom-input" id="emission-custom-${id}" placeholder="CUSTOM" oninput="resizeMissionInput(this)" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomMissionType(${id});resizeMissionInput(this);}">
        <button type="button" class="mission-custom-add" onclick="addCustomMissionType(${id})">+</button>
      </div>
    </div>`;
}

function addCustomMissionType(id: number): void {
  const input = document.getElementById(`emission-custom-${id}`) as HTMLInputElement | null;
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  input.value = '';
  const tagsRow = document.getElementById(`emission-tags-${id}`);
  if (!tagsRow) return;
  if (tagsRow.querySelector(`[data-mission="${CSS.escape(val)}"]`)) return;
  tagsRow.insertAdjacentHTML('beforeend', missionTagHtml(id, val));
}

function resizeMissionInput(input: HTMLInputElement): void {
  const span = document.createElement('span');
  Object.assign(span.style, { position:'fixed', top:'-9999px', left:'-9999px', whiteSpace:'pre', visibility:'hidden', fontFamily:'Inter,sans-serif', fontSize:'12px' });
  span.textContent = input.value || input.placeholder;
  document.body.appendChild(span);
  input.style.width = (span.offsetWidth + 12) + 'px';
  document.body.removeChild(span);
}

function toggleMissionPanel(id: number): void {
  document.getElementById(`emission-panel-${id}`)?.classList.toggle('open');
  const input = document.getElementById(`emission-custom-${id}`) as HTMLInputElement | null;
  if (input) resizeMissionInput(input);
}

function toggleMissionType(id: number, type: string): void {
  const chip = document.querySelector<HTMLElement>(`#emission-panel-${id} [data-mission="${type}"]`);
  if (!chip) return;
  const adding = !chip.classList.contains('selected');
  chip.classList.toggle('selected');
  const tagsRow = document.getElementById(`emission-tags-${id}`);
  if (!tagsRow) return;
  if (adding) {
    tagsRow.insertAdjacentHTML('beforeend', missionTagHtml(id, type));
  } else {
    tagsRow.querySelector<HTMLElement>(`[data-mission="${type}"]`)?.remove();
  }
}

function removeMissionType(id: number, type: string): void {
  document.getElementById(`emission-tags-${id}`)?.querySelector<HTMLElement>(`[data-mission="${type}"]`)?.remove();
  const chip = document.querySelector<HTMLElement>(`#emission-panel-${id} [data-mission="${type}"]`);
  chip?.classList.remove('selected');
}


// ─── Expandable pickers (cards & nouveau vol) ───────────────────────────────

function aircraftTagHtml2(contextId: string, model: string): string {
  const sm = escapeHtml(model);
  const mod = DCS_MODULES.find(m => (m.variants ?? [m.name]).includes(model));
  const colorKey = escapeHtml(mod ? `aircraft:${mod.name}` : `aircraft:${model}`);
  return `<span class="mission-tag" data-aircraft="${sm}">${sm}<button type="button" class="mission-tag-color" onclick="openTagColorPopup('${colorKey}',this)">${DROPPER_SVG}</button><button type="button" class="mission-tag-remove" onclick="removeAircraftType('${contextId}','${sm}')"><img src="./icons/close.png" alt="×"></button></span>`;
}

function mapTagHtml2(contextId: string, mapName: string, label: string): string {
  const sm = escapeHtml(mapName);
  const colorKey = escapeHtml(`map:${mapName}`);
  return `<span class="mission-tag" data-map="${sm}">${escapeHtml(label)}<button type="button" class="mission-tag-color" onclick="openTagColorPopup('${colorKey}',this)">${DROPPER_SVG}</button><button type="button" class="mission-tag-remove" onclick="removeMapType('${contextId}','${sm}')"><img src="./icons/close.png" alt="×"></button></span>`;
}

function renderAircraftPickerExpandable(contextId: string, selected: string[]): string {
  if (!profile.modules.length) return `<span class="pf-empty">${t('profile_no_modules_configured')}</span>`;
  const ownedMods = DCS_MODULES.filter(mod => getEffectiveOwnedModuleNames().has(mod.name));
  const modelsSet = new Set<string>();
  ownedMods.forEach(mod => (mod.variants ?? [mod.name]).forEach(m => modelsSet.add(m)));
  const models = Array.from(modelsSet).sort();
  const tags = selected.filter(m => models.includes(m)).map(m => aircraftTagHtml2(contextId, m)).join('');
  const chips = models.map(model => {
    const sel = selected.includes(model);
    return `<button type="button" class="mission-chip${sel ? ' selected' : ''}" onclick="toggleAircraftType('${contextId}','${escapeHtml(model)}')" data-aircraft="${escapeHtml(model)}">${escapeHtml(model)}</button>`;
  }).join('');
  return `<div class="mission-picker-row"><div class="mission-tags-row" id="aircraft-tags-${contextId}">${tags}</div><button type="button" class="mission-add-btn" onclick="toggleAircraftPanel('${contextId}')">+</button></div><div class="mission-panel" id="aircraft-panel-${contextId}">${chips}</div>`;
}

function renderMapPickerExpandable(contextId: string, selected: string[]): string {
  if (!profile.maps.length) return `<span class="pf-empty">${t('profile_no_maps_configured')}</span>`;
  const tags = selected.filter(m => profile.maps.includes(m)).map(mapName => {
    const map = DCS_MAPS.find(d => d.name === mapName);
    return mapTagHtml2(contextId, mapName, map ? (map.abbr ?? t(map.key)) : mapName);
  }).join('');
  const chips = profile.maps.map(mapName => {
    const map = DCS_MAPS.find(d => d.name === mapName);
    const label = map ? (map.abbr ?? t(map.key)) : mapName;
    const sel = selected.includes(mapName);
    return `<button type="button" class="mission-chip${sel ? ' selected' : ''}" onclick="toggleMapType('${contextId}','${escapeHtml(mapName)}')" data-map="${escapeHtml(mapName)}">${escapeHtml(label)}</button>`;
  }).join('');
  return `<div class="mission-picker-row"><div class="mission-tags-row" id="map-tags-${contextId}">${tags}</div><button type="button" class="mission-add-btn" onclick="toggleMapPanel('${contextId}')">+</button></div><div class="mission-panel" id="map-panel-${contextId}">${chips}</div>`;
}

function toggleAircraftPanel(contextId: string): void {
  document.getElementById(`aircraft-panel-${contextId}`)?.classList.toggle('open');
}
function toggleAircraftType(contextId: string, model: string): void {
  const chip = document.querySelector<HTMLElement>(`#aircraft-panel-${contextId} [data-aircraft="${model}"]`);
  if (!chip) return;
  const adding = !chip.classList.contains('selected');
  chip.classList.toggle('selected');
  const tagsRow = document.getElementById(`aircraft-tags-${contextId}`);
  if (!tagsRow) return;
  if (adding) tagsRow.insertAdjacentHTML('beforeend', aircraftTagHtml2(contextId, model));
  else tagsRow.querySelector<HTMLElement>(`[data-aircraft="${model}"]`)?.remove();
}
function removeAircraftType(contextId: string, model: string): void {
  document.getElementById(`aircraft-tags-${contextId}`)?.querySelector<HTMLElement>(`[data-aircraft="${model}"]`)?.remove();
  document.querySelector<HTMLElement>(`#aircraft-panel-${contextId} [data-aircraft="${model}"]`)?.classList.remove('selected');
}

function toggleMapPanel(contextId: string): void {
  document.getElementById(`map-panel-${contextId}`)?.classList.toggle('open');
}
function toggleMapType(contextId: string, mapName: string): void {
  const chip = document.querySelector<HTMLElement>(`#map-panel-${contextId} [data-map="${mapName}"]`);
  if (!chip) return;
  const adding = !chip.classList.contains('selected');
  chip.classList.toggle('selected');
  const tagsRow = document.getElementById(`map-tags-${contextId}`);
  if (!tagsRow) return;
  const map = DCS_MAPS.find(d => d.name === mapName);
  const label = map ? (map.abbr ?? t(map.key)) : mapName;
  if (adding) tagsRow.insertAdjacentHTML('beforeend', mapTagHtml2(contextId, mapName, label));
  else tagsRow.querySelector<HTMLElement>(`[data-map="${mapName}"]`)?.remove();
}
function removeMapType(contextId: string, mapName: string): void {
  document.getElementById(`map-tags-${contextId}`)?.querySelector<HTMLElement>(`[data-map="${mapName}"]`)?.remove();
  document.querySelector<HTMLElement>(`#map-panel-${contextId} [data-map="${mapName}"]`)?.classList.remove('selected');
}

function avatarHtml(name: string, avatar?: string, size = 80): string {
  if (avatar) return `<img class="pf-avatar-img" src="${avatar}" alt="avatar" width="${size}" height="${size}">`;
  const svgRaw = boringAvatar(name || 'pilot', size);
  const b64 = btoa(unescape(encodeURIComponent(svgRaw)));
  return `<img class="pf-avatar-img" src="data:image/svg+xml;base64,${b64}" alt="avatar" width="${size}" height="${size}">`;
}

function renderProfileView(): void {
  if (!profile.maps) profile.maps = [];
  if (!profile.modules) profile.modules = [];
  const content = document.getElementById('pf-content')!;
  const tags = profile.modules.length
    ? profile.modules.map(m => `<span class="pf-module-tag">${escapeHtml(m)}</span>`).join('')
    : `<span class="pf-empty">${t('profile_no_modules')}</span>`;
  const mapTags = profile.maps.length
    ? profile.maps.map(m => { const mp = DCS_MAPS.find(d => d.name === m); return `<span class="pf-map-tag">${escapeHtml(mp ? t(mp.key) : m)}</span>`; }).join('')
    : `<span class="pf-empty">${t('profile_no_maps')}</span>`;
  content.innerHTML = `
    <div class="pf-view">
      <div class="pf-avatar-section">
        ${avatarHtml(profile.name, profile.avatar, 80)}
        <div class="pf-pilot-name">${profile.name ? escapeHtml(profile.name) : `<span class="pf-empty">${t('profile_name_undefined')}</span>`}</div>
        <button class="btn-sm" onclick="editProfile()">${t('profile_edit_btn')}</button>
      </div>
      <div class="pf-section">
        <div class="pf-section-title">${t('profile_maps_count', { count: profile.maps.length })}</div>
        <div class="pf-modules-display">${mapTags}</div>
      </div>
      <div class="pf-section">
        <div class="pf-section-title">${t('profile_modules_count', { count: profile.modules.length })}</div>
        <div class="pf-modules-display">${tags}</div>
      </div>
    </div>`;
}

function editProfile(): void {
  profileEditing = true;
  pendingAvatarChange = undefined;
  if (!profile.maps) profile.maps = [];
  if (!profile.modules) profile.modules = [];
  const content = document.getElementById('pf-content')!;
  const grid = DCS_MODULES.map(mod => {
    const sel = profile.modules.includes(mod.name);
    return `<button type="button" class="pf-module-toggle${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')" data-module="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</button>`;
  }).join('');
  const mapsGrid = DCS_MAPS.map(map => {
    const sel = profile.maps.includes(map.name);
    const label = map.abbr ? `${map.name} (${map.abbr})` : t(map.key);
    return `<button type="button" class="pf-map-toggle${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')" data-map="${escapeHtml(map.name)}">${escapeHtml(label)}</button>`;
  }).join('');
  const removeBtn = profile.avatar ? `<button class="btn-sm btn-cancel" onclick="removeAvatar()">${t('profile_delete_photo')}</button>` : '';
  content.innerHTML = `
    <div class="pf-edit">
      <div class="pf-field">
        <label class="pf-label">${t('profile_photo_label')}</label>
        <div class="pf-avatar-edit-row">
          <div class="pf-avatar-preview" id="pf-avatar-preview">${avatarHtml(profile.name, profile.avatar, 72)}</div>
          <div class="pf-avatar-controls">
            <label class="btn-sm pf-avatar-label" for="pf-avatar-input">${t('profile_choose_image')}</label>
            <input type="file" id="pf-avatar-input" accept="image/*" style="display:none" onchange="uploadAvatar(event)">
            <span class="pf-avatar-hint">${t('profile_image_hint')}</span>
            <div id="pf-avatar-remove-wrap">${removeBtn}</div>
          </div>
        </div>
      </div>
      <div class="pf-field">
        <label class="pf-label">${t('profile_pilot_name')}</label>
        <input type="text" id="pf-name-input" class="pf-input" value="${escapeHtml(profile.name)}" placeholder="">
      </div>
      <div class="pf-field">
        <label class="pf-label">${t('profile_maps')}</label>
        <div class="page-search-bar" id="pf-map-search-bar"><input type="text" id="pf-map-search" placeholder=" " oninput="filterMaps()"><span id="pf-map-search-hint">${t('profile_map_search')}</span></div>
        <div class="pf-maps-grid">${mapsGrid}</div>
      </div>
      <div class="pf-field">
        <label class="pf-label">${t('profile_modules')}</label>
        <div class="page-search-bar" id="pf-module-search-bar"><input type="text" id="pf-module-search" placeholder=" " oninput="filterModules()"><span id="pf-module-search-hint">${t('profile_module_search')}</span></div>
        <div class="pf-modules-grid">${grid}</div>
      </div>
      <div class="pf-edit-actions">
        <button class="btn-sm" onclick="saveProfile()">${t('profile_save')}</button>
        <button class="btn-sm btn-cancel" onclick="cancelEditProfile()">${t('profile_cancel')}</button>
      </div>
    </div>`;
}

function uploadAvatar(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 128;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      const s = Math.min(img.width, img.height);
      const ox = (img.width - s) / 2, oy = (img.height - s) / 2;
      ctx.drawImage(img, ox, oy, s, s, 0, 0, SIZE, SIZE);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      pendingAvatarChange = dataUrl;
      profile = { ...profile, avatar: dataUrl };
      updateProfileBtn();
      saveToFile();
      const preview = document.getElementById('pf-avatar-preview');
      if (preview) preview.innerHTML = `<img class="pf-avatar-img" src="${dataUrl}" alt="avatar" width="72" height="72">`;
      const wrap = document.getElementById('pf-avatar-remove-wrap');
      if (wrap && !wrap.querySelector('button')) wrap.innerHTML = `<button class="btn-sm btn-cancel" onclick="removeAvatar()">${t('profile_delete_photo')}</button>`;
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function removeAvatar(): void {
  const nameVal = (document.getElementById('pf-name-input') as HTMLInputElement)?.value || profile.name;
  pendingAvatarChange = null;
  profile = { ...profile, avatar: undefined };
  saveToFile();
  updateProfileBtn();
  const preview = document.getElementById('pf-avatar-preview');
  if (preview) preview.innerHTML = avatarHtml(nameVal, undefined, 72);
  const wrap = document.getElementById('pf-avatar-remove-wrap');
  if (wrap) wrap.innerHTML = '';
}

function filterModules(): void {
  const query = (document.getElementById('pf-module-search') as HTMLInputElement).value.toLowerCase().trim();
  document.querySelectorAll<HTMLElement>('.pf-module-toggle').forEach(btn => {
    const name = (btn.dataset.module || '').toLowerCase();
    btn.style.display = !query || name.includes(query) ? '' : 'none';
  });
}

function filterMaps(): void {
  const query = (document.getElementById('pf-map-search') as HTMLInputElement).value.toLowerCase().trim();
  document.querySelectorAll<HTMLElement>('.pf-map-toggle').forEach(btn => {
    const mapName = btn.dataset.map || '';
    const map = DCS_MAPS.find(d => d.name === mapName);
    const searchable = map ? `${map.name} ${map.abbr ?? ''} ${t(map.key)}`.toLowerCase() : mapName.toLowerCase();
    btn.style.display = !query || searchable.includes(query) ? '' : 'none';
  });
}

function cancelEditProfile(): void { profileEditing = false; pendingAvatarChange = undefined; renderProfileView(); }

async function saveProfile(): Promise<void> {
  profileEditing = false;
  const name = (document.getElementById('pf-name-input') as HTMLInputElement).value.trim();
  const modules = Array.from(document.querySelectorAll<HTMLElement>('.pf-module-toggle.selected'))
    .map(el => el.dataset.module!).filter(Boolean);
  const maps = Array.from(document.querySelectorAll<HTMLElement>('.pf-map-toggle.selected'))
    .map(el => el.dataset.map!).filter(Boolean);
  const avatar = pendingAvatarChange !== undefined
    ? (pendingAvatarChange ?? undefined)
    : profile.avatar;
  pendingAvatarChange = undefined;
  profile = { ...profile, name, modules, maps, avatar };
  updateProfileBtn();
  renderProfileView();
  renderSessions();
  await saveToFile();
}

// ─── i18n refresh ──────────────────────────────────────────────────────────

async function setLanguage(lang: string): Promise<void> {
  await setLang(lang);
  applyStaticTranslations();
  syncTrayLabels();
  renderSessions();
  // Timer state
  const siLabel = document.getElementById('si-label');
  if (siLabel) siLabel.textContent = activeStart ? t('session_active') : t('session_waiting');
  const btn = document.getElementById('btn-toggle') as HTMLButtonElement | null;
  if (btn) btn.textContent = activeStart ? t('session_stop') : t('session_start');
  // Save indicator text
  const si = document.getElementById('save-indicator');
  if (si) si.textContent = t('save_indicator');
  // Profile page if visible
  const pfPage = document.getElementById('profile-page');
  if (pfPage && pfPage.style.display !== 'none') {
    if (profileEditing) editProfile(); else renderProfileView();
  }
  syncBurgerState();
  renderCustomisationSection();
}

// ─── Tag color customisation ────────────────────────────────────────────────

function getTextColorForBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#111108' : '#e8dcc8';
}

function loadTagColors(): Record<string, { light: string; dark: string }> {
  const result: Record<string, { light: string; dark: string }> = {};
  for (const [k, v] of Object.entries(TAG_COLOR_DEFAULTS)) result[k] = { ...v };
  for (const map of DCS_MAPS) result[`map:${map.name}`] = { ...TAG_MAP_DEFAULT };
  for (const mod of DCS_MODULES) result[`aircraft:${mod.name}`] = { ...TAG_AIRCRAFT_DEFAULT };
  try {
    const saved = localStorage.getItem('tagColors');
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, { light?: string; dark?: string }>;
      for (const [k, v] of Object.entries(parsed)) {
        if (result[k]) {
          if (v.light) result[k].light = v.light;
          if (v.dark) result[k].dark = v.dark;
        }
      }
    }
  } catch { /* use defaults */ }
  return result;
}

function saveTagColors(colors: Record<string, { light: string; dark: string }>): void {
  const toSave: Record<string, { light: string; dark: string }> = {};
  for (const [k, v] of Object.entries(colors)) {
    const def = TAG_COLOR_DEFAULTS[k] ?? (k.startsWith('map:') ? TAG_MAP_DEFAULT : k.startsWith('aircraft:') ? TAG_AIRCRAFT_DEFAULT : null);
    if (!def || v.light !== def.light || v.dark !== def.dark) toSave[k] = v;
  }
  if (Object.keys(toSave).length > 0) localStorage.setItem('tagColors', JSON.stringify(toSave));
  else localStorage.removeItem('tagColors');
}

// ─── Live color state (pas de sauvegarde automatique) ─────────────────────

let _liveTagColors: Record<string, {light:string;dark:string}> = loadTagColors();
let _tagColorsDirty = false;

function _updateCustSaveBtn(): void {
  const row = document.getElementById('cust-save-row') as HTMLElement | null;
  if (row) row.style.display = _tagColorsDirty ? 'flex' : 'none';
}

function saveTagColorsManual(): void {
  saveTagColors(_liveTagColors);
  _tagColorsDirty = false;
  _updateCustSaveBtn();
}

function saveTagColorsPopup(): void {
  applyTagColors();
  closeTagColorPopup();
}

function cancelTagColors(): void {
  closeTagColorPopup();
  closeTagEditor();
  _liveTagColors = loadTagColors();
  _tagColorsDirty = false;
  _updateCustSaveBtn();
  applyTagColors();
}

function applyTagColors(): void {
  const colors = _liveTagColors;
  let css = '';
  for (const [m, c] of Object.entries(colors)) {
    if (m.startsWith('map:') || m.startsWith('aircraft:')) continue;
    const lt = getTextColorForBg(c.light);
    const dt = getTextColorForBg(c.dark);
    const base = `.mission-chip[data-mission="${m}"],.mission-tag[data-mission="${m}"],.s-mission-tag[data-mission="${m}"]`;
    css += `${base}{background:${c.light}!important;border-color:${c.light}!important;color:${lt}!important;}`;
    const darkBase = base.split(',').map(s => `[data-theme="dark-brown"] ${s.trim()}`).join(',');
    css += `${darkBase}{background:${c.dark}!important;border-color:${c.dark}!important;color:${dt}!important;}`;
  }
  for (const map of DCS_MAPS) {
    const c = colors[`map:${map.name}`] ?? TAG_MAP_DEFAULT;
    const lt = getTextColorForBg(c.light); const dt = getTextColorForBg(c.dark);
    const v = map.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    css += `.s-map-tag[data-map="${v}"],.mission-tag[data-map="${v}"]{background:${c.light}!important;color:${lt}!important;}`;
    css += `[data-theme="dark-brown"] .s-map-tag[data-map="${v}"],[data-theme="dark-brown"] .mission-tag[data-map="${v}"]{background:${c.dark}!important;color:${dt}!important;}`;
  }
  for (const mod of DCS_MODULES) {
    const c = colors[`aircraft:${mod.name}`] ?? TAG_AIRCRAFT_DEFAULT;
    const lt = getTextColorForBg(c.light); const dt = getTextColorForBg(c.dark);
    const variants = mod.variants ?? [mod.name];
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const ls = variants.map(v => `.s-aircraft-tag[data-aircraft="${esc(v)}"],.mission-tag[data-aircraft="${esc(v)}"]`).join(',');
    const ds = variants.map(v => `[data-theme="dark-brown"] .s-aircraft-tag[data-aircraft="${esc(v)}"],[data-theme="dark-brown"] .mission-tag[data-aircraft="${esc(v)}"]`).join(',');
    css += `${ls}{background:${c.light}!important;color:${lt}!important;}`;
    css += `${ds}{background:${c.dark}!important;color:${dt}!important;}`;
  }
  let el = document.getElementById('tag-color-overrides') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'tag-color-overrides';
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function renderCustomisationSection(): void {
  const body = document.getElementById('cust-section-body');
  if (!body) return;
  const missionChips = MISSION_TYPES.map(m => {
    const sk = escapeHtml(m);
    return `<button class="cust-chip s-mission-tag" id="cust-chip-${sk}" data-mission="${sk}" onclick="openTagEditor('${sk}')">${sk}</button>`;
  }).join('');
  const mapChips = DCS_MAPS.map(map => {
    const key = `map:${map.name}`;
    const sk = escapeHtml(key);
    const label = escapeHtml(map.abbr ?? t(map.key));
    return `<button class="cust-chip s-map-tag" id="cust-chip-${sk}" data-map="${escapeHtml(map.name)}" onclick="openTagEditor('${sk}')">${label}</button>`;
  }).join('');
  const moduleChips = DCS_MODULES.map(mod => {
    const key = `aircraft:${mod.name}`;
    const sk = escapeHtml(key);
    const firstVariant = escapeHtml((mod.variants ?? [mod.name])[0]);
    return `<button class="cust-chip s-aircraft-tag" id="cust-chip-${sk}" data-aircraft="${firstVariant}" onclick="openTagEditor('${sk}')">${escapeHtml(mod.name)}</button>`;
  }).join('');
  const sub = (id: string, label: string, searchBarId: string, searchId: string, hintId: string, hint: string, chipsId: string, chips: string, editorId: string) =>
    `<div class="cust-subsection">
      <div class="cust-sub-title" onclick="toggleCustSub(this)"><span class="cust-chevron">▾</span><span>${label}</span></div>
      <div class="cust-subsection-body" id="${id}">
        <div class="page-search-bar cust-search-bar" id="${searchBarId}">
          <input type="text" id="${searchId}" placeholder=" " oninput="filterCustChips('${chipsId}',this.value)">
          <span id="${hintId}">${hint}</span>
        </div>
        <div class="cust-chips-row" id="${chipsId}">${chips}</div>
        <div class="cust-editor-panel" id="${editorId}" style="display:none"></div>
      </div>
    </div>`;
  body.innerHTML =
    sub('cust-sub-missions','Missions','cust-mission-search-bar','cust-mission-search','cust-mission-hint',escapeHtml(t('cust_search_mission')),'cust-missions-chips',missionChips,'cust-editor-missions') +
    sub('cust-sub-maps','Maps','cust-map-search-bar','cust-map-search','cust-map-hint',escapeHtml(t('profile_map_search')),'cust-maps-chips',mapChips,'cust-editor-maps') +
    sub('cust-sub-modules','Modules','cust-module-search-bar','cust-module-search','cust-module-hint',escapeHtml(t('profile_module_search')),'cust-modules-chips',moduleChips,'cust-editor-modules') +
    `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
      <div id="cust-save-row" style="display:none;gap:6px;align-items:center;">
        <button class="btn-sm" onclick="saveTagColorsManual()">${escapeHtml(t('cust_save_colors'))}</button>
        <button class="btn-sm btn-cancel" onclick="cancelTagColors()">${escapeHtml(t('cust_cancel_colors'))}</button>
      </div>
      <div style="flex:1"></div>
      <button class="btn-sm btn-danger" onclick="resetAllTagColors()">${escapeHtml(t('cust_reset_all_colors'))}</button>
    </div>`;
  _updateCustSaveBtn();
}

function toggleCustSub(titleEl: HTMLElement): void {
  const sub = titleEl.closest('.cust-subsection') as HTMLElement | null;
  if (!sub) return;
  const body = sub.querySelector<HTMLElement>('.cust-subsection-body');
  if (!body) return;
  if (sub.classList.contains('collapsed')) {
    sub.classList.remove('collapsed');
    body.style.overflow = 'hidden';
    body.style.maxHeight = '0';
    requestAnimationFrame(() => {
      body.style.maxHeight = body.scrollHeight + 'px';
      let done = false;
      const finish = () => { if (done) return; done = true; body.style.maxHeight = ''; body.style.overflow = ''; };
      body.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 200);
    });
  } else {
    body.style.overflow = 'hidden';
    body.style.maxHeight = body.scrollHeight + 'px';
    body.getBoundingClientRect();
    sub.classList.add('collapsed');
    body.style.maxHeight = '0';
  }
}

function filterCustChips(chipsRowId: string, query: string): void {
  const row = document.getElementById(chipsRowId);
  if (!row) return;
  const q = query.toLowerCase().trim();
  row.querySelectorAll<HTMLElement>('.cust-chip').forEach(chip => {
    chip.style.display = !q || (chip.textContent?.toLowerCase() ?? '').includes(q) ? '' : 'none';
  });
}

const PEN_SVG = `<svg class="cust-pen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const DROPPER_SVG = `<svg class="tag-dropper-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8-2.2 2.2"/></svg>`;

function makeEditorHTML(sk: string, sl: string, c: {light: string; dark: string}, ltText: string, dtText: string, isDefault: boolean, closeFn: string): string {
  const colorBtn = (theme: 'light'|'dark', val: string) =>
    `<span class="cust-color-btn">${PEN_SVG}<input type="color" class="cust-color-input" id="color-${sk}-${theme}" value="${val}" onchange="updateTagColor('${sk}','${theme}',this.value)"></span>`;
  return `<button class="cust-editor-close" onclick="${closeFn}" title="Close">×</button>
  <div class="cust-editor-row">
    <div class="cust-theme-col">
      <span class="cust-theme-label">Light</span>
      <div class="cust-theme-preview cust-light-bg">
        <div class="cust-tag-label-wrap">
          <span class="cust-tag-sample" id="prev-${sk}-light" style="background:${c.light};color:${ltText}">${sl}</span>
          ${colorBtn('light', c.light)}
        </div>
      </div>
    </div>
    <div class="cust-sync-col">
      <button class="cust-sync-btn" onclick="syncTagColor('${sk}','light')" title="Copy light → dark">→</button>
      <button class="cust-sync-btn" onclick="syncTagColor('${sk}','dark')" title="Copy dark → light">←</button>
      <button class="cust-sync-btn" onclick="swapTagColors('${sk}')" title="Swap light ↔ dark">⇄</button>
    </div>
    <div class="cust-theme-col">
      <span class="cust-theme-label">Dark</span>
      <div class="cust-theme-preview cust-dark-bg">
        <div class="cust-tag-label-wrap">
          <span class="cust-tag-sample" id="prev-${sk}-dark" style="background:${c.dark};color:${dtText}">${sl}</span>
          ${colorBtn('dark', c.dark)}
        </div>
      </div>
    </div>
    <button class="cust-reset-btn" id="reset-${sk}" style="${isDefault ? 'visibility:hidden' : ''}" onclick="resetTagColor('${sk}')" title="Reset to default">↺</button>
  </div>`;
}

function resolveTagEditorData(tagKey: string): { sk: string; sl: string; c: {light:string;dark:string}; ltText: string; dtText: string; isDefault: boolean; def: {light:string;dark:string}|null } {
  const def = TAG_COLOR_DEFAULTS[tagKey] ?? (tagKey.startsWith('map:') ? TAG_MAP_DEFAULT : tagKey.startsWith('aircraft:') ? TAG_AIRCRAFT_DEFAULT : null);
  const c = _liveTagColors[tagKey] ?? def ?? { light: '#888888', dark: '#888888' };
  const isDefault = def ? c.light === def.light && c.dark === def.dark : true;
  const sk = escapeHtml(tagKey);
  let label: string;
  if (tagKey.startsWith('map:')) { const mp = DCS_MAPS.find(d => d.name === tagKey.slice(4)); label = mp ? t(mp.key) : tagKey.slice(4); }
  else if (tagKey.startsWith('aircraft:')) { label = tagKey.slice(9); }
  else { label = tagKey; }
  return { sk, sl: escapeHtml(label), c, ltText: getTextColorForBg(c.light), dtText: getTextColorForBg(c.dark), isDefault, def };
}

function openTagEditor(tagKey: string): void {
  const panelId = tagKey.startsWith('map:') ? 'cust-editor-maps' : tagKey.startsWith('aircraft:') ? 'cust-editor-modules' : 'cust-editor-missions';
  const panel = document.getElementById(panelId) as HTMLElement | null;
  if (!panel) return;
  const isOpen = panel.dataset.openKey === tagKey && panel.style.display !== 'none';
  document.querySelectorAll<HTMLElement>('.cust-editor-panel:not(#tag-color-popup)').forEach(p => { p.style.display = 'none'; p.dataset.openKey = ''; });
  document.querySelectorAll<HTMLElement>('.cust-chip').forEach(el => el.classList.remove('open'));
  if (isOpen) return;
  document.getElementById(`cust-chip-${tagKey}`)?.classList.add('open');
  const { sk, sl, c, ltText, dtText, isDefault } = resolveTagEditorData(tagKey);
  panel.dataset.openKey = tagKey;
  panel.style.display = '';
  panel.innerHTML = makeEditorHTML(sk, sl, c, ltText, dtText, isDefault, 'closeTagEditor()') +
    `<div style="display:flex;gap:6px;padding:6px 8px 4px;margin-top:6px;border-top:1px solid var(--border);">
      <button class="btn-sm" onclick="closeTagEditor()">${escapeHtml(t('cust_confirm_popup'))}</button>
      <button class="btn-sm btn-cancel" onclick="cancelTagColors()">${escapeHtml(t('cust_cancel_colors'))}</button>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTagEditor(): void {
  document.querySelectorAll<HTMLElement>('.cust-editor-panel:not(#tag-color-popup)').forEach(p => { p.style.display = 'none'; p.dataset.openKey = ''; });
  document.querySelectorAll<HTMLElement>('.cust-chip').forEach(el => el.classList.remove('open'));
}

function openTagColorPopup(tagKey: string, triggerEl: HTMLElement): void {
  const popup = document.getElementById('tag-color-popup') as HTMLElement | null;
  if (!popup) return;
  if (popup.dataset.openKey === tagKey && popup.style.display !== 'none') { closeTagColorPopup(); return; }
  const { sk, sl, c, ltText, dtText, isDefault } = resolveTagEditorData(tagKey);
  popup.dataset.openKey = tagKey;
  popup.innerHTML = makeEditorHTML(sk, sl, c, ltText, dtText, isDefault, 'closeTagColorPopup()') +
    `<div style="display:flex;gap:6px;padding:6px 8px 4px;margin-top:6px;border-top:1px solid var(--border);">
      <button class="btn-sm" onclick="saveTagColorsPopup()">${escapeHtml(t('cust_confirm_popup'))}</button>
      <button class="btn-sm btn-cancel" onclick="cancelTagColors()">${escapeHtml(t('cust_cancel_colors'))}</button>
    </div>`;
  popup.style.display = '';
  const rect = triggerEl.getBoundingClientRect();
  const pw = popup.offsetWidth || 280;
  popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - pw - 8)) + 'px';
  popup.style.top = (rect.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', _popupOutside, { once: true }), 0);
}

function _popupOutside(e: MouseEvent): void {
  const popup = document.getElementById('tag-color-popup');
  if (popup && !popup.contains(e.target as Node)) closeTagColorPopup();
  else if (popup && popup.style.display !== 'none') setTimeout(() => document.addEventListener('click', _popupOutside, { once: true }), 0);
}

function closeTagColorPopup(): void {
  const popup = document.getElementById('tag-color-popup') as HTMLElement | null;
  if (popup) { popup.style.display = 'none'; popup.dataset.openKey = ''; }
}


function _custSyncUI(tagKey: string, colors: Record<string, { light: string; dark: string }>): void {
  const c = colors[tagKey];
  if (!c) return;
  for (const theme of ['light', 'dark'] as const) {
    const color = c[theme];
    const preview = document.getElementById(`prev-${tagKey}-${theme}`);
    if (preview) { (preview as HTMLElement).style.background = color; (preview as HTMLElement).style.color = getTextColorForBg(color); }
    const input = document.getElementById(`color-${tagKey}-${theme}`) as HTMLInputElement | null;
    if (input) input.value = color;
  }
  const def = TAG_COLOR_DEFAULTS[tagKey] ?? (tagKey.startsWith('map:') ? TAG_MAP_DEFAULT : tagKey.startsWith('aircraft:') ? TAG_AIRCRAFT_DEFAULT : null);
  const resetBtn = document.getElementById(`reset-${tagKey}`);
  if (resetBtn && def) (resetBtn as HTMLElement).style.visibility = (c.light === def.light && c.dark === def.dark) ? 'hidden' : '';
}

function updateTagColor(tagKey: string, theme: 'light' | 'dark', color: string): void {
  if (!_liveTagColors[tagKey]) _liveTagColors[tagKey] = { ...(TAG_COLOR_DEFAULTS[tagKey] ?? { light: '#888888', dark: '#888888' }) };
  _liveTagColors[tagKey][theme] = color;
  _tagColorsDirty = true;
  _updateCustSaveBtn();
  applyTagColors();
  const preview = document.getElementById(`prev-${tagKey}-${theme}`);
  if (preview) { (preview as HTMLElement).style.background = color; (preview as HTMLElement).style.color = getTextColorForBg(color); }
  const def = TAG_COLOR_DEFAULTS[tagKey] ?? (tagKey.startsWith('map:') ? TAG_MAP_DEFAULT : tagKey.startsWith('aircraft:') ? TAG_AIRCRAFT_DEFAULT : null);
  const resetBtn = document.getElementById(`reset-${tagKey}`);
  if (resetBtn && def) (resetBtn as HTMLElement).style.visibility = (_liveTagColors[tagKey].light === def.light && _liveTagColors[tagKey].dark === def.dark) ? 'hidden' : '';
}

function syncTagColor(tagKey: string, from: 'light' | 'dark'): void {
  const to: 'light' | 'dark' = from === 'light' ? 'dark' : 'light';
  if (!_liveTagColors[tagKey]) _liveTagColors[tagKey] = { ...(TAG_COLOR_DEFAULTS[tagKey] ?? { light: '#888888', dark: '#888888' }) };
  _liveTagColors[tagKey][to] = _liveTagColors[tagKey][from];
  _tagColorsDirty = true;
  _updateCustSaveBtn();
  applyTagColors();
  _custSyncUI(tagKey, _liveTagColors);
}

function swapTagColors(tagKey: string): void {
  if (!_liveTagColors[tagKey]) _liveTagColors[tagKey] = { ...(TAG_COLOR_DEFAULTS[tagKey] ?? { light: '#888888', dark: '#888888' }) };
  const tmp = _liveTagColors[tagKey].light;
  _liveTagColors[tagKey].light = _liveTagColors[tagKey].dark;
  _liveTagColors[tagKey].dark = tmp;
  _tagColorsDirty = true;
  _updateCustSaveBtn();
  applyTagColors();
  _custSyncUI(tagKey, _liveTagColors);
}

function resetTagColor(tagKey: string): void {
  const def = TAG_COLOR_DEFAULTS[tagKey] ?? (tagKey.startsWith('map:') ? TAG_MAP_DEFAULT : tagKey.startsWith('aircraft:') ? TAG_AIRCRAFT_DEFAULT : null);
  if (!def) return;
  _liveTagColors[tagKey] = { ...def };
  _tagColorsDirty = true;
  _updateCustSaveBtn();
  applyTagColors();
  _custSyncUI(tagKey, _liveTagColors);
}

// ─── Indicateur de sauvegarde ──────────────────────────────────────────────

document.body.insertAdjacentHTML('beforeend', `<div id="save-indicator">${t('save_indicator')}</div>`);
document.body.insertAdjacentHTML('beforeend', `<div id="tag-color-popup" class="cust-editor-panel tag-color-popup" style="display:none;position:fixed;z-index:9999;"></div>`);

// ─── Exposer les fonctions au HTML inline ──────────────────────────────────

window.toggleSession = toggleSession;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.loadFile = loadFile;
window.toggleSteamEdit = toggleSteamEdit;
window.saveSteam = saveSteam;
window.toggleEdit = toggleEdit;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteSession = deleteSession;
window.updateEditResult = updateEditResult;
window.toggleCard  = toggleCard;
window.confirmDebrief = confirmDebrief;
window.skipDebrief = skipDebrief;
(window as any).deleteDebrief = deleteDebrief;
function handleSearchInput(): void {
  const mainEl = document.getElementById('log-page') as HTMLElement;
  if (mainEl.style.display === 'none') {
    hidAllPages();
    mainEl.style.display = '';
    document.getElementById('nav-historique')?.classList.add('active');
    document.getElementById('burger-historique')?.classList.add('active');
  }
  renderSessions();
}
window.filterSessions = handleSearchInput;
window.showProfile = showProfile;
(window as any).showHistorique = showHistorique;
(window as any).showNewFlight = showNewFlight;
(window as any).cancelNewFlight = cancelNewFlight;
(window as any).updateNewFlightResult = updateNewFlightResult;
(window as any).saveNewFlight = saveNewFlight;
(window as any).showSettings = showSettings;
(window as any).saveSettings = saveSettings;
(window as any).cancelSettings = cancelSettings;
(window as any).onSettingChange = onSettingChange;
(window as any).confirmSettingsLeave = confirmSettingsLeave;
(window as any).confirmTagColorsLeave = confirmTagColorsLeave;
(window as any).confirmCardLeave = confirmCardLeave;
(window as any).confirmNewFlightLeave = confirmNewFlightLeave;
(window as any).confirmProfileLeave = confirmProfileLeave;
(window as any).toggleSection = toggleSection;
(window as any).toggleBurger = toggleBurger;
(window as any).toggleMissionPanel = toggleMissionPanel;
(window as any).toggleMissionType = toggleMissionType;
(window as any).removeMissionType = removeMissionType;
(window as any).addCustomMissionType = addCustomMissionType;
(window as any).resizeMissionInput = resizeMissionInput;
(window as any).closeBurger = closeBurger;
(window as any).syncBurgerSearch = syncBurgerSearch;
window.hideProfile = hideProfile;
window.editProfile = editProfile;
window.cancelEditProfile = cancelEditProfile;
window.saveProfile = saveProfile;
(window as any).filterModules = filterModules;
(window as any).filterMaps = filterMaps;
(window as any).toggleAircraftPanel = toggleAircraftPanel;
(window as any).toggleAircraftType = toggleAircraftType;
(window as any).removeAircraftType = removeAircraftType;
(window as any).toggleMapPanel = toggleMapPanel;
(window as any).toggleMapType = toggleMapType;
(window as any).removeMapType = removeMapType;
(window as any).uploadAvatar = uploadAvatar;
(window as any).removeAvatar = removeAvatar;
(window as any).setLanguage = setLanguage;

function setTheme(theme: string): void {
  const root = document.getElementById('dcs-root') as HTMLElement;
  if (theme === 'parchment') { root.removeAttribute('data-theme'); document.body.removeAttribute('data-theme'); }
  else { root.setAttribute('data-theme', theme); document.body.setAttribute('data-theme', theme); }
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.theme === theme);
  });
}
(window as any).setTheme = setTheme;
(window as any).updateTagColor = updateTagColor;
(window as any).syncTagColor = syncTagColor;
(window as any).swapTagColors = swapTagColors;
(window as any).resetTagColor = resetTagColor;
(window as any).saveTagColorsManual = saveTagColorsManual;
(window as any).saveTagColorsPopup = saveTagColorsPopup;
(window as any).cancelTagColors = cancelTagColors;
(window as any).openTagEditor = openTagEditor;
(window as any).closeTagEditor = closeTagEditor;
(window as any).openTagColorPopup = openTagColorPopup;
(window as any).closeTagColorPopup = closeTagColorPopup;
(window as any).toggleCustSub = toggleCustSub;
(window as any).filterCustChips = filterCustChips;

window.tbMinimize = () => getCurrentWindow().minimize();
window.tbMaximize = () => getCurrentWindow().toggleMaximize();
window.tbClose = async () => {
  if (activeStart) {
    const pref = localStorage.getItem('traySessionBehavior');
    if (pref === 'minimize') {
      await invoke('minimize_to_tray');
      return;
    }
    const pendingUpdate = await invoke<UpdateInfo | null>('get_pending_update').catch(() => null);
    if (pref === 'stop-close') {
      _discardActiveSession();
      if (pendingUpdate) { showUpdateModal(pendingUpdate, true); return; }
      await invoke('force_close');
      return;
    }
    _showTrayCloseDialog(pendingUpdate);
    return;
  }
  await getCurrentWindow().close();
};

// ─── Démarrage ─────────────────────────────────────────────────────────────

async function setupLang(lang: string): Promise<void> {
  await setLang(lang);
  const overlay = document.getElementById('lang-setup-overlay');
  if (overlay) overlay.style.display = 'none';
  applyStaticTranslations();
}
(window as unknown as Record<string, unknown>).setupLang = setupLang;

function filterSettings(): void {
  const query = ((document.getElementById('st-search-input') as HTMLInputElement)?.value || '').toLowerCase().trim();
  document.querySelectorAll<HTMLElement>('#st-content .st-section').forEach(section => {
    section.style.display = (!query || section.textContent?.toLowerCase().includes(query)) ? '' : 'none';
  });
}
(window as unknown as Record<string, unknown>).filterSettings = filterSettings;

function showLangOverlay(): void {
  const overlay = document.getElementById('lang-setup-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function applyDevMode(): void {
  const active = localStorage.getItem('devMode') === '1';
  const panel = document.getElementById('dev-tools-panel');
  const btn = document.getElementById('dev-mode-btn');
  if (panel) panel.style.display = active ? 'block' : 'none';
  if (btn) {
    btn.textContent = active ? t('dev_mode_disable') : t('dev_mode_enable');
    btn.classList.toggle('btn-cancel', active);
  }
}

function toggleDevMode(): void {
  const active = localStorage.getItem('devMode') === '1';
  if (active) localStorage.removeItem('devMode');
  else localStorage.setItem('devMode', '1');
  applyDevMode();
}

(window as unknown as Record<string, unknown>).showLangOverlay = showLangOverlay;

function resetAllTagColors(): void {
  if (!confirm(t('cust_reset_all_confirm1'))) return;
  if (!confirm(t('cust_reset_all_confirm2'))) return;
  localStorage.removeItem('tagColors');
  _liveTagColors = loadTagColors();
  _tagColorsDirty = false;
  _updateCustSaveBtn();
  applyTagColors();
  renderCustomisationSection();
}
(window as unknown as Record<string, unknown>).resetAllTagColors = resetAllTagColors;

function factoryReset(): void {
  if (!confirm(t('factory_reset_confirm1'))) return;
  if (!confirm(t('factory_reset_confirm2'))) return;
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
}
(window as unknown as Record<string, unknown>).factoryReset = factoryReset;
(window as unknown as Record<string, unknown>).toggleDevMode = toggleDevMode;

// ─── Auto-update ─────────────────────────────────────────────────────────────

function _showUpdateActions(isClosing: boolean): void {
  const el = document.getElementById('update-actions');
  if (!el) return;
  if (isClosing) {
    el.innerHTML =
      `<button class="btn-sm" onclick="installUpdate()">${escapeHtml(t('update_install_close'))}</button>` +
      `<button class="btn-sm btn-cancel" onclick="forceCloseApp()">${escapeHtml(t('update_skip_close'))}</button>`;
  } else {
    el.innerHTML =
      `<button class="btn-sm" onclick="installUpdate()">${escapeHtml(t('update_install_btn'))}</button>` +
      `<button class="btn-sm btn-cancel" onclick="dismissUpdateModal()">${escapeHtml(t('update_later_btn'))}</button>`;
  }
}

function showUpdateModal(info: UpdateInfo, isClosing: boolean): void {
  const overlay  = document.getElementById('update-overlay') as HTMLElement;
  const badge    = document.getElementById('update-version-badge') as HTMLElement;
  const preBadge = document.getElementById('update-prerelease-badge') as HTMLElement;
  const body     = document.getElementById('update-body') as HTMLElement;
  const aName    = document.getElementById('update-asset-name') as HTMLElement;
  const aSize    = document.getElementById('update-asset-size') as HTMLElement;
  const aSha     = document.getElementById('update-asset-sha') as HTMLElement;

  badge.textContent               = `${info.current_version} → ${info.new_version}`;
  preBadge.style.display          = info.is_prerelease ? 'inline-block' : 'none';
  body.innerHTML                  = mdParse(info.body) || '<p>—</p>';
  aName.textContent               = info.asset.name;
  aSize.textContent               = info.asset.size_fmt;
  aSha.textContent                = info.asset.sha256 || t('update_no_sha');

  overlay.dataset.downloadUrl     = info.asset.download_url;
  overlay.dataset.sha256          = info.asset.sha256;
  overlay.dataset.fileName        = info.asset.name;

  document.getElementById('update-installing-msg')!.style.display = 'none';
  _showUpdateActions(isClosing);
  overlay.style.display = 'flex';
}
(window as unknown as Record<string, unknown>).showUpdateModal = showUpdateModal;

async function installUpdate(): Promise<void> {
  const overlay = document.getElementById('update-overlay') as HTMLElement;
  const actions = document.getElementById('update-actions') as HTMLElement;
  const msg     = document.getElementById('update-installing-msg') as HTMLElement;

  actions.style.display = 'none';
  msg.style.display = '';

  try {
    await invoke('download_and_install', {
      downloadUrl:      overlay.dataset.downloadUrl,
      expectedSha256:   overlay.dataset.sha256,
      fileName:         overlay.dataset.fileName,
    });
  } catch (err) {
    msg.style.display = 'none';
    actions.style.display = '';
    alert(String(err));
  }
}
(window as unknown as Record<string, unknown>).installUpdate = installUpdate;

async function dismissUpdateModal(): Promise<void> {
  document.getElementById('update-overlay')!.style.display = 'none';
  await invoke('dismiss_update');
}
(window as unknown as Record<string, unknown>).dismissUpdateModal = dismissUpdateModal;

async function forceCloseApp(): Promise<void> {
  await invoke('force_close');
}
(window as unknown as Record<string, unknown>).forceCloseApp = forceCloseApp;

async function previewUpdateModal(): Promise<void> {
  const ver = await invoke<string>('get_app_version').catch(() => '1.0.5');
  const next = bumpPatchVersion(ver);
  const inclPre = localStorage.getItem('updateIncludePrerelease') === '1';
  const fake: UpdateInfo = {
    current_version: ver,
    new_version: inclPre ? `${next}-beta.1` : next,
    is_prerelease: inclPre,
    body: `## Nouveautés\n\n- Rendu Markdown dans la modale de mise à jour\n- Option pré-version dans les paramètres\n- Corrections diverses\n\n## Correctifs\n\n- Fix crash au démarrage sur Windows 11\n- Fix couleurs des tags non appliquées après import JSON\n\n---\n\n**SHA-256** vérification automatique avant installation.`,
    asset: {
      name: `flight-log_${inclPre ? next + '-beta.1' : next}_x64_en-US.msi`,
      size: 14_200_000,
      size_fmt: '14.2 MB',
      download_url: '',
      sha256: 'aabbccdd112233440011223344556677aabbccdd112233440011223344556677aa',
    },
  };
  showUpdateModal(fake, false);
}
(window as unknown as Record<string, unknown>).previewUpdateModal = previewUpdateModal;

function bumpPatchVersion(ver: string): string {
  const p = ver.split('.');
  p[p.length - 1] = String(Number(p[p.length - 1] || 0) + 1);
  return p.join('.');
}

function setPrereleasePreference(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem('updateIncludePrerelease', '1');
  } else {
    localStorage.removeItem('updateIncludePrerelease');
  }
}
(window as unknown as Record<string, unknown>).setPrereleasePreference = setPrereleasePreference;

// ─── Tray close ──────────────────────────────────────────────────────────────

let _pendingUpdateOnClose: UpdateInfo | null = null;

function _discardActiveSession(): void {
  if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
  activeStart = null;
  const siLabel = document.getElementById('si-label');
  const btn = document.getElementById('btn-toggle') as HTMLButtonElement | null;
  if (siLabel) siLabel.textContent = t('session_waiting');
  if (btn) btn.textContent = t('session_start');
}

function _showTrayCloseDialog(pendingUpdate: UpdateInfo | null): void {
  _pendingUpdateOnClose = pendingUpdate;
  const overlay = document.getElementById('tray-overlay') as HTMLElement;
  overlay.style.display = 'flex';
  const rem = document.getElementById('tray-remember') as HTMLInputElement | null;
  if (rem) rem.checked = false;
}

async function trayChooseMinimize(): Promise<void> {
  const rem = (document.getElementById('tray-remember') as HTMLInputElement)?.checked;
  if (rem) { localStorage.setItem('traySessionBehavior', 'minimize'); _refreshTrayPrefRow(); }
  document.getElementById('tray-overlay')!.style.display = 'none';
  await invoke('minimize_to_tray');
}
(window as unknown as Record<string, unknown>).trayChooseMinimize = trayChooseMinimize;

async function trayChooseStopClose(): Promise<void> {
  const rem = (document.getElementById('tray-remember') as HTMLInputElement)?.checked;
  if (rem) { localStorage.setItem('traySessionBehavior', 'stop-close'); _refreshTrayPrefRow(); }
  document.getElementById('tray-overlay')!.style.display = 'none';
  _discardActiveSession();
  const upd = _pendingUpdateOnClose;
  _pendingUpdateOnClose = null;
  if (upd) {
    showUpdateModal(upd, true);
  } else {
    await invoke('force_close');
  }
}
(window as unknown as Record<string, unknown>).trayChooseStopClose = trayChooseStopClose;

function resetTrayPreference(): void {
  localStorage.removeItem('traySessionBehavior');
  _refreshTrayPrefRow();
}
(window as unknown as Record<string, unknown>).resetTrayPreference = resetTrayPreference;

function _refreshTrayPrefRow(): void {
  const val = document.getElementById('tray-pref-value') as HTMLElement | null;
  const btn = document.getElementById('btn-reset-tray') as HTMLButtonElement | null;
  const pref = localStorage.getItem('traySessionBehavior');
  if (val) {
    if (pref === 'minimize')    val.textContent = t('tray_pref_minimize');
    else if (pref === 'stop-close') val.textContent = t('tray_pref_stop_close');
    else                        val.textContent = '—';
  }
  if (btn) btn.disabled = !pref;
}

async function checkUpdateManual(): Promise<void> {
  const btn = document.getElementById('btn-check-update') as HTMLButtonElement | null;
  const msg = document.getElementById('update-status-msg') as HTMLElement | null;
  if (btn) { btn.disabled = true; btn.textContent = t('update_checking'); }
  if (msg) msg.textContent = '';
  const inclPre = localStorage.getItem('updateIncludePrerelease') === '1';
  try {
    const info = await invoke<UpdateInfo | null>('check_update', { includePrerelease: inclPre });
    if (info) {
      showUpdateModal(info, false);
    } else {
      if (msg) msg.textContent = t('update_up_to_date');
    }
  } catch (_err) {
    if (msg) msg.textContent = t('update_error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('settings_check_update'); }
  }
}
(window as unknown as Record<string, unknown>).checkUpdateManual = checkUpdateManual;

window.addEventListener('DOMContentLoaded', async () => {
  const isFirstLaunch = !localStorage.getItem('lang');
  await initI18n();
  await loadFromFile();
  applyStaticTranslations();
  if (isFirstLaunch) {
    const overlay = document.getElementById('lang-setup-overlay');
    if (overlay) overlay.style.display = 'flex';
  }
  applyDevMode();
  applyTagColors();
  renderCustomisationSection();
  const savedTheme = localStorage.getItem('theme') || 'parchment';
  setTheme(savedTheme);
  // Set dynamic initial state labels
  const siLabel = document.getElementById('si-label');
  if (siLabel) siLabel.textContent = t('session_waiting');
  const btn = document.getElementById('btn-toggle') as HTMLButtonElement | null;
  if (btn) btn.textContent = t('session_start');
  const si = document.getElementById('save-indicator');
  if (si) si.textContent = t('save_indicator');
  updateProfileBtn();
  updateSteamDisplay();
  updateTotal();
  renderSessions();

  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.addEventListener('mouseenter', () => searchBar.classList.add('hovered'));
    searchBar.addEventListener('mouseleave', () => searchBar.classList.remove('hovered'));
  }

  // Startup update check (silent — read pref from localStorage)
  const _inclPre = localStorage.getItem('updateIncludePrerelease') === '1';
  invoke<UpdateInfo | null>('check_update', { includePrerelease: _inclPre })
    .then(info => { if (info) showUpdateModal(info, false); })
    .catch(() => { /* silently ignore network errors on startup */ });

  // Sync pre-release toggle state to checkbox
  const _preToggle = document.getElementById('toggle-prerelease') as HTMLInputElement | null;
  if (_preToggle) _preToggle.checked = _inclPre;

  // Refresh tray preference display in Settings
  _refreshTrayPrefRow();

  // Update-on-close: Rust emits this when a pending update exists and user closes
  listen<UpdateInfo>('update-check-on-close', (event) => {
    const overlay = document.getElementById('update-overlay') as HTMLElement;
    if (overlay.style.display === 'flex') {
      _showUpdateActions(true);
    } else {
      showUpdateModal(event.payload, true);
    }
  });

  syncTrayLabels();
});
