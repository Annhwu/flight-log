// This file is a module (has top-level imports/exports) so declare global works.
export { };

import { getCurrentWindow } from '@tauri-apps/api/window';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Session {
  id: number;
  startTs: number;
  endTs: number;
  durationMin: number;
  name?: string;
  notes?: string;
  aircraft?: string[];
}

interface DCSModule {
  name: string;
  variants?: string[];
  includes?: string[];
}

interface Profile {
  name: string;
  modules: string[];
}

interface AppData {
  steamMinutes: number;
  sessions: Session[];
  profile?: Profile;
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
let profile: Profile = { name: '', modules: [] };

// ─── Utilitaires ───────────────────────────────────────────────────────────

function pad(n: number): string { return String(n).padStart(2, '0'); }
function escapeHtml(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtTime(d: Date): string { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function fmtDate(d: Date): string { return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
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
      profile  = data.profile  ?? { name: '', modules: [] };
    }
  } catch {
    // Pas de fichier existant, on démarre vide
  }
}

function showSaveIndicator(): void {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

// ─── Export / Import ────────────────────────────────────────────────────────

async function exportJSON(): Promise<void> {
  const data: AppData = { steamMinutes, sessions };
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
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data: AppData = JSON.parse((e.target as FileReader).result as string);
      steamMinutes = data.steamMinutes ?? 0;
      sessions = data.sessions ?? [];
      await saveToFile();
      updateSteamDisplay();
      updateTotal();
      renderSessions();
    } catch {
      alert('Fichier JSON invalide.');
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

function toggleSession(): void {
  const btn = document.getElementById('btn-toggle') as HTMLButtonElement;
  if (!activeStart) {
    activeStart = new Date();
    btn.textContent = '■ OFF';
    btn.classList.add('active');
    const siLabel = document.getElementById('si-label');
    const siTime = document.getElementById('si-time');
    if (siLabel) siLabel.textContent = 'Session en cours';
    if (siTime) siTime.textContent = fmtDate(activeStart) + ' — ' + fmtTime(activeStart);
    elapsedInterval = window.setInterval(updateElapsed, 1000);
    updateElapsed();
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
    btn.textContent = '▶ ON';
    btn.classList.remove('active');
    const siLabel = document.getElementById('si-label');
    const siTime = document.getElementById('si-time');
    const siElapsed = document.getElementById('si-elapsed');
    if (siLabel) siLabel.textContent = 'En attente';
    if (siTime) siTime.textContent = '--:--:--';
    if (siElapsed) siElapsed.textContent = '';
    openDebrief();
  }
}

function openDebrief(): void {
  if (!pendingSession) return;
  const num = sessions.length + 1;
  (document.getElementById('debrief-num') as HTMLElement).textContent = 'Vol #' + pad(num);
  (document.getElementById('debrief-dur') as HTMLElement).textContent = durLabel(pendingSession.durationMin);
  (document.getElementById('debrief-name') as HTMLInputElement).value = '';
  (document.getElementById('debrief-notes') as HTMLTextAreaElement).value = '';
  const picker = document.getElementById('debrief-aircraft-picker');
  if (picker) picker.innerHTML = renderAircraftPickerHtml([]);
  document.getElementById('debrief-overlay')!.classList.add('open');
  setTimeout(() => (document.getElementById('debrief-name') as HTMLInputElement).focus(), 50);
}

async function confirmDebrief(): Promise<void> {
  if (!pendingSession) return;
  pendingSession.name  = (document.getElementById('debrief-name') as HTMLInputElement).value.trim() || undefined;
  pendingSession.notes = (document.getElementById('debrief-notes') as HTMLTextAreaElement).value.trim() || undefined;
  pendingSession.aircraft = Array.from(document.querySelectorAll<HTMLElement>('#debrief-aircraft-picker .aircraft-toggle.selected')).map(el => el.dataset.aircraft!).filter(Boolean);
  if (!pendingSession.aircraft.length) pendingSession.aircraft = undefined;
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

function updateElapsed(): void {
  if (!activeStart) return;
  const el = document.getElementById('si-elapsed');
  if (el) el.textContent = '⏱ ' + secsToHMS(Math.floor((Date.now() - activeStart.getTime()) / 1000));
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
    list.innerHTML = '<div id="empty-msg">Aucune session enregistrée <span id="blink">_</span></div>';
    sc.textContent = '';
    return;
  }

  const numbered = sessions.map((s, i) => ({ s, num: sessions.length - i }));
  const filtered = query
    ? numbered.filter(({ s, num }) => {
        const q = query.replace(/^#/, '');
        return String(num).includes(q)
          || (s.name?.toLowerCase().includes(query) ?? false)
          || (s.notes?.toLowerCase().includes(query) ?? false);
      })
    : numbered;

  sc.textContent = sessions.length + ' session(s) · ' + minsToHM(totalSAMin());

  if (!filtered.length) {
    list.innerHTML = '<div id="empty-msg">Aucun vol ne correspond à la recherche.</div>';
    return;
  }

  list.innerHTML = filtered.map(({ s, num }) => {
    const start = new Date(s.startTs);
    const end   = new Date(s.endTs);
    const nameLine     = s.name  ? `<div class="s-name">${escapeHtml(s.name)}</div>` : '';
    const notesBadge   = s.notes ? `<div class="row s-note-badge">Détail supplémentaire</div>` : '';
    const aircraftRow  = s.aircraft?.length ? `<div class="s-aircraft-row">${s.aircraft.map(a => `<span class="s-aircraft-tag">${escapeHtml(a)}</span>`).join('')}</div>` : '';
    const notesFull    = s.notes
      ? `<div class="s-notes-full">${escapeHtml(s.notes).replace(/\n/g, '<br>')}</div>`
      : `<div class="s-notes-empty">Aucune note pour ce vol.</div>`;
    return `<div class="session-card" id="sc-${s.id}">
      <div class="card-header" onclick="toggleCard(${s.id})">
        <div class="s-num">#${pad(num)}</div>
        <div class="s-times">
          ${nameLine}
          <div class="row">Déb&nbsp;<span>${fmtDate(start)} ${pad(start.getHours())}:${pad(start.getMinutes())}</span></div>
          <div class="row">Fin&nbsp;<span>${fmtDate(end)} ${pad(end.getHours())}:${pad(end.getMinutes())}</span></div>
          ${notesBadge}
          ${aircraftRow}
        </div>
        <div class="s-dur">${durLabel(s.durationMin)}</div>
        <button class="btn-icon" onclick="event.stopPropagation();toggleEdit(${s.id})" title="Éditer"><img src="./src/icons/pencil.png" width="16" height="16"></button>
        <button class="btn-icon btn-icon-danger" onclick="event.stopPropagation();deleteSession(${s.id})" title="Supprimer"><img src="./src/icons/trash.png" width="16" height="16"></button>
      </div>
      <div class="s-details" id="details-${s.id}">
        ${notesFull}
      </div>
      <div class="edit-row" id="edit-${s.id}" onclick="event.stopPropagation()">
        <div class="edit-block">
          <div class="edit-block-label">Début</div>
          <div class="edit-fields-row">
            <div class="ef-group"><label>Jour</label><input type="date" id="edate1-${s.id}" value="${fmtDateInput(start)}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-sep">—</div>
            <div class="ef-group"><label>h</label><input type="number" id="eh1-${s.id}" min="0" max="23" value="${start.getHours()}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-group"><label>min</label><input type="number" id="em1-${s.id}" min="0" max="59" value="${start.getMinutes()}" oninput="updateEditResult(${s.id})"></div>
          </div>
        </div>
        <div class="edit-block">
          <div class="edit-block-label">Fin</div>
          <div class="edit-fields-row">
            <div class="ef-group"><label>Jour</label><input type="date" id="edate2-${s.id}" value="${fmtDateInput(end)}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-sep">—</div>
            <div class="ef-group"><label>h</label><input type="number" id="eh2-${s.id}" min="0" max="23" value="${end.getHours()}" oninput="updateEditResult(${s.id})"></div>
            <div class="ef-group"><label>min</label><input type="number" id="em2-${s.id}" min="0" max="59" value="${end.getMinutes()}" oninput="updateEditResult(${s.id})"></div>
          </div>
        </div>
        <div class="edit-result">
          <span class="res-label">Durée calculée</span>
          <span class="res-dur" id="res-dur-${s.id}">${durLabel(s.durationMin)}</span>
        </div>
        <div class="notes-group">
          <label class="edit-block-label">Nom du vol</label>
          <input type="text" id="ename-${s.id}" class="debrief-input" style="width:100%" placeholder="ex : Patrouille sur le Caucase" value="${escapeHtml(s.name || '')}">
        </div>
        <div class="notes-group">
          <label class="edit-block-label">Appareil(s) volé(s)</label>
          <div id="eaircraft-${s.id}" class="aircraft-picker-scroll">${renderAircraftPickerHtml(s.aircraft ?? [])}</div>
        </div>
        <div class="notes-group">
          <label class="edit-block-label">Détail du vol</label>
          <textarea id="enotes-${s.id}" class="notes-textarea" placeholder="Commentaire..." oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'">${escapeHtml(s.notes || '')}</textarea>
        </div>
        <div class="edit-actions">
          <button class="btn-sm" onclick="saveEdit(${s.id})">Valider</button>
          <button class="btn-sm" onclick="cancelEdit(${s.id})">Annuler</button>
          <button class="btn-danger" onclick="deleteSession(${s.id})">Supprimer</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleCard(id: number): void {
  const card    = document.getElementById('sc-' + id) as HTMLElement;
  const details = document.getElementById('details-' + id) as HTMLElement;
  const editRow = document.getElementById('edit-' + id) as HTMLElement;
  const isOpen  = card.classList.contains('expanded');
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
  const row  = document.getElementById('edit-' + id) as HTMLElement;
  const card = document.getElementById('sc-' + id) as HTMLElement;
  if (row.style.display === 'flex') {
    row.style.display = 'none';
    card.classList.remove('editing');
  } else {
    card.classList.add('expanded', 'editing');
    (document.getElementById('details-' + id) as HTMLElement).style.display = 'none';
    row.style.display = 'flex';
    setTimeout(() => {
      const ta = document.getElementById('enotes-' + id) as HTMLTextAreaElement;
      if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
    }, 0);
  }
}
function cancelEdit(id: number): void {
  (document.getElementById('edit-' + id) as HTMLElement).style.display = 'none';
  const card = document.getElementById('sc-' + id) as HTMLElement;
  card.classList.remove('editing');
  (document.getElementById('details-' + id) as HTMLElement).style.display = 'block';
}
async function saveEdit(id: number): Promise<void> {
  const res = calcEditDur(id); if (!res) return;
  const idx = sessions.findIndex(s => s.id === id); if (idx < 0) return;
  sessions[idx].startTs = res.start.getTime();
  sessions[idx].endTs = res.end.getTime();
  sessions[idx].durationMin = res.dur;
  sessions[idx].name  = (document.getElementById('ename-'  + id) as HTMLInputElement).value.trim() || undefined;
  sessions[idx].notes = (document.getElementById('enotes-' + id) as HTMLTextAreaElement).value.trim() || undefined;
  const ac = Array.from(document.querySelectorAll<HTMLElement>(`#eaircraft-${id} .aircraft-toggle.selected`)).map(el => el.dataset.aircraft!).filter(Boolean);
  sessions[idx].aircraft = ac.length ? ac : undefined;
  renderSessions(); updateTotal(); await saveToFile();
}
async function deleteSession(id: number): Promise<void> {
  sessions = sessions.filter(s => s.id !== id);
  renderSessions(); updateTotal(); await saveToFile();
}

// ─── Profil ────────────────────────────────────────────────────────────────

function updateProfileBtn(): void {
  const btn = document.getElementById('profile-btn');
  if (btn) btn.textContent = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
}

function showProfile(): void {
  (document.getElementById('navbar') as HTMLElement).style.display = 'none';
  (document.getElementById('main')  as HTMLElement).style.display = 'none';
  const pg = document.getElementById('profile-page') as HTMLElement;
  pg.style.display = 'flex';
  renderProfileView();
}

function hideProfile(): void {
  (document.getElementById('navbar') as HTMLElement).style.display = '';
  (document.getElementById('main')  as HTMLElement).style.display = '';
  (document.getElementById('profile-page') as HTMLElement).style.display = 'none';
}

function getEffectiveOwnedModuleNames(): Set<string> {
  const owned = new Set(profile.modules);
  DCS_MODULES.forEach(mod => {
    if (owned.has(mod.name) && mod.includes) mod.includes.forEach(inc => owned.add(inc));
  });
  return owned;
}

function renderAircraftPickerHtml(selected: string[]): string {
  if (!profile.modules.length) return `<span class="pf-empty">Aucun module configuré dans le profil.</span>`;
  const ownedMods = DCS_MODULES.filter(mod => getEffectiveOwnedModuleNames().has(mod.name));
  const modelsSet = new Set<string>();
  ownedMods.forEach(mod => (mod.variants ?? [mod.name]).forEach(m => modelsSet.add(m)));
  return Array.from(modelsSet).sort().map(model => {
    const sel = selected.includes(model);
    return `<button type="button" class="aircraft-toggle${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')" data-aircraft="${escapeHtml(model)}">${escapeHtml(model)}</button>`;
  }).join('');
}

function renderProfileView(): void {
  const content = document.getElementById('pf-content')!;
  const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
  const tags = profile.modules.length
    ? profile.modules.map(m => `<span class="pf-module-tag">${escapeHtml(m)}</span>`).join('')
    : `<span class="pf-empty">Aucun module sélectionné</span>`;
  content.innerHTML = `
    <div class="pf-view">
      <div class="pf-avatar-section">
        <div class="pf-avatar-lg">${initial}</div>
        <div class="pf-pilot-name">${profile.name ? escapeHtml(profile.name) : '<span class="pf-empty">Nom non défini</span>'}</div>
        <button class="btn-sm" onclick="editProfile()">Éditer le profil</button>
      </div>
      <div class="pf-section">
        <div class="pf-section-title">Modules DCS possédés (${profile.modules.length})</div>
        <div class="pf-modules-display">${tags}</div>
      </div>
    </div>`;
}

function editProfile(): void {
  const content = document.getElementById('pf-content')!;
  const grid = DCS_MODULES.map(mod => {
    const sel = profile.modules.includes(mod.name);
    return `<button type="button" class="pf-module-toggle${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')" data-module="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</button>`;
  }).join('');
  content.innerHTML = `
    <div class="pf-edit">
      <div class="pf-field">
        <label class="pf-label">Nom du pilote</label>
        <input type="text" id="pf-name-input" class="pf-input" value="${escapeHtml(profile.name)}" placeholder="">
      </div>
      <div class="pf-field">
        <label class="pf-label">Modules DCS possédés</label>
        <div class="pf-modules-grid">${grid}</div>
      </div>
      <div class="pf-edit-actions">
        <button class="btn" onclick="saveProfile()">Sauvegarder</button>
        <button class="btn-sm" onclick="cancelEditProfile()">Annuler</button>
      </div>
    </div>`;
}

function cancelEditProfile(): void { renderProfileView(); }

async function saveProfile(): Promise<void> {
  const name = (document.getElementById('pf-name-input') as HTMLInputElement).value.trim();
  const modules = Array.from(document.querySelectorAll<HTMLElement>('.pf-module-toggle.selected'))
    .map(el => el.dataset.module!).filter(Boolean);
  profile = { name, modules };
  updateProfileBtn();
  renderProfileView();
  renderSessions();
  await saveToFile();
}

// ─── Indicateur de sauvegarde ──────────────────────────────────────────────

document.body.insertAdjacentHTML('beforeend', '<div id="save-indicator">✓ Sauvegardé</div>');

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
window.filterSessions = renderSessions;
window.showProfile = showProfile;
window.hideProfile = hideProfile;
window.editProfile = editProfile;
window.cancelEditProfile = cancelEditProfile;
window.saveProfile = saveProfile;
window.tbMinimize = () => getCurrentWindow().minimize();
window.tbMaximize = () => getCurrentWindow().toggleMaximize();
window.tbClose = () => getCurrentWindow().close();

// ─── Démarrage ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  await loadFromFile();
  updateProfileBtn();
  updateSteamDisplay();
  updateTotal();
  renderSessions();
});
