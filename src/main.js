import { getCurrentWindow } from '@tauri-apps/api/window';
import { initI18n, t, setLang, getLocale, applyStaticTranslations } from './i18n';
const MISSION_TYPES = ['Training', 'CAP', 'CAS', 'SEAD', 'Strike', 'Intercept', 'Recon', 'Anti-Ship'];
async function invoke(cmd, args) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args);
}
// ─── State ─────────────────────────────────────────────────────────────────
const DCS_MODULES = [
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
let sessions = [];
let steamMinutes = 0;
let activeStart = null;
let elapsedInterval = null;
let pendingSession = null;
let profile = { name: '', modules: [] };
let settingsDirty = false;
let profileEditing = false;
let pendingAvatarChange = undefined;
let editingCardId = null;
// ─── Utilitaires ───────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function fmtDate(d) { return d.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtDateInput(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function minsToHM(m) { const h = Math.floor(m / 60), mm = Math.round(m % 60); return pad(h) + 'h ' + pad(mm) + 'm'; }
function secsToHMS(s) { const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.round(s % 60); return pad(h) + 'h ' + pad(mm) + 'm ' + pad(ss) + 's'; }
function durLabel(min) { const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = Math.round(min % 60); return (d > 0 ? d + 'j ' : '') + pad(h) + 'h ' + pad(m) + 'm'; }
function generateBoringAvatar(seed, size = 80) {
    const PALETTE = ['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90'];
    const S = 36;
    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) - h) + str.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    }
    function unit(n, range, idx) {
        const v = n % (idx * range);
        return v > range ? v % range : v;
    }
    function color(n) { return PALETTE[n % PALETTE.length]; }
    function contrast(hex) {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#ffffff';
    }
    const n = hash(seed || 'pilot');
    const bgColor = color(n + 13);
    const wrapColor = color(n);
    const faceColor = contrast(wrapColor);
    const preX = unit(n, 10, 1), preY = unit(n, 10, 2);
    const tx = preX < 5 ? preX + S * 0.1 : preX;
    const ty = preY < 5 ? preY + S * 0.1 : preY;
    const rot = unit(n, 360, 3);
    const scale = 1 + unit(n, Math.floor(S / 12), 4) / 10;
    const isCircle = unit(n, 2, 14);
    const isMouthOpen = unit(n, 2, 13);
    const eyeSpread = unit(n, 10, 12);
    const faceRot = unit(n, 10, 6);
    const ftx = tx > S / 6 ? tx / 2 : unit(n, 8, 7);
    const fty = ty > S / 6 ? ty / 2 : unit(n, 7, 8);
    const rx = isCircle ? S / 2 : S / 6;
    const mid = S / 2;
    const id = 'm' + (n % 99999);
    const mouth = isMouthOpen
        ? `<path d="M15 ${19 + eyeSpread}c2 1 4 1 6 0" stroke="${faceColor}" fill="none" stroke-linecap="round"/>`
        : `<path d="M13,${19 + eyeSpread} a1,0.75 0 0,0 10,0" fill="${faceColor}"/>`;
    return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><mask id="${id}"><rect width="${S}" height="${S}" rx="${S * 2}" fill="#fff"/></mask><g mask="url(#${id})"><rect width="${S}" height="${S}" fill="${bgColor}"/><rect x="0" y="0" width="${S}" height="${S}" transform="translate(${tx} ${ty}) rotate(${rot} ${mid} ${mid}) scale(${scale})" fill="${wrapColor}" rx="${rx}"/><g transform="translate(${ftx} ${fty}) rotate(${faceRot} ${mid} ${mid})">${mouth}<rect x="${14 - eyeSpread}" y="14" width="1.5" height="2" rx="1" fill="${faceColor}"/><rect x="${20 + eyeSpread}" y="14" width="1.5" height="2" rx="1" fill="${faceColor}"/></g></g></svg>`;
}
// ─── Sauvegarde automatique via Tauri ──────────────────────────────────────
async function saveToFile() {
    const data = { steamMinutes, sessions, profile };
    await invoke('save_data', { content: JSON.stringify(data, null, 2) });
    showSaveIndicator();
}
async function loadFromFile() {
    try {
        const content = await invoke('load_data');
        if (content) {
            const data = JSON.parse(content);
            steamMinutes = data.steamMinutes ?? 0;
            sessions = data.sessions ?? [];
            profile = data.profile ?? { name: '', modules: [] };
        }
    }
    catch {
        // Pas de fichier existant, on démarre vide
    }
}
document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    const isText = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (!isText)
        e.preventDefault();
});
let _lastBtnRect = null;
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, label[class*="btn"]');
    if (btn)
        _lastBtnRect = btn.getBoundingClientRect();
}, true);
function showSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (!el)
        return;
    el.classList.remove('show');
    void el.offsetWidth;
    const w = el.offsetWidth || 160, h = el.offsetHeight || 44;
    if (_lastBtnRect) {
        const r = _lastBtnRect;
        let x = r.right + 8;
        let y = r.top + r.height / 2 - h / 2;
        if (x + w > window.innerWidth - 8)
            x = r.left - w - 8;
        x = Math.max(x, 8);
        y = Math.min(Math.max(y, 8), window.innerHeight - h - 8);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
    else {
        el.style.right = '16px';
        el.style.bottom = '16px';
        el.style.left = 'auto';
        el.style.top = 'auto';
    }
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 900);
}
// ─── Export / Import ────────────────────────────────────────────────────────
async function exportJSON() {
    const data = { steamMinutes, sessions, ...(profile.exportProfile ? { profile } : {}) };
    const json = JSON.stringify(data, null, 2);
    const options = {
        defaultPath: 'export_dcs_flight_log.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
    };
    const filePath = await window.__TAURI_INTERNALS__.invoke('plugin:dialog|save', { options });
    if (filePath) {
        await invoke('save_file', { path: filePath, content: json });
    }
}
function importJSON() {
    document.getElementById('file-input')?.click();
}
function loadFile(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file)
        return;
    input.value = '';
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            steamMinutes = data.steamMinutes ?? 0;
            sessions = data.sessions ?? [];
            if (data.profile && profile.importProfile) {
                profile = { ...data.profile, importProfile: profile.importProfile, exportProfile: profile.exportProfile };
                updateProfileBtn();
                const pfPage = document.getElementById('profile-page');
                if (pfPage && pfPage.style.display !== 'none')
                    renderProfileView();
            }
            await saveToFile();
            updateSteamDisplay();
            updateTotal();
            renderSessions();
        }
        catch {
            alert(t('error_invalid_json'));
        }
    };
    reader.readAsText(file);
}
// ─── Steam ─────────────────────────────────────────────────────────────────
function updateSteamDisplay() {
    const el = document.getElementById('steam-display');
    if (el)
        el.textContent = minsToHM(steamMinutes);
}
function toggleSteamEdit() {
    const row = document.getElementById('steam-input-row');
    if (row.style.display === 'flex') {
        row.style.display = 'none';
        return;
    }
    row.style.display = 'flex';
    document.getElementById('steam-h-inp').value = String(Math.floor(steamMinutes / 60));
    document.getElementById('steam-m-inp').value = String(steamMinutes % 60);
}
async function saveSteam() {
    steamMinutes =
        (parseInt(document.getElementById('steam-h-inp').value) || 0) * 60 +
            (parseInt(document.getElementById('steam-m-inp').value) || 0);
    document.getElementById('steam-input-row').style.display = 'none';
    updateSteamDisplay();
    updateTotal();
    await saveToFile();
}
// ─── Total ─────────────────────────────────────────────────────────────────
function totalSAMin() { return sessions.reduce((a, s) => a + (s.durationMin || 0), 0); }
function updateTotal() {
    const el = document.getElementById('total-hours');
    if (el)
        el.textContent = minsToHM(steamMinutes + totalSAMin());
}
// ─── Session ON/OFF ────────────────────────────────────────────────────────
function toggleSession() {
    const btn = document.getElementById('btn-toggle');
    if (!activeStart) {
        activeStart = new Date();
        btn.textContent = t('session_stop');
        btn.classList.add('active');
        const siLabel = document.getElementById('si-label');
        const siTime = document.getElementById('si-time');
        if (siLabel)
            siLabel.textContent = t('session_active');
        if (siTime)
            siTime.textContent = fmtDate(activeStart) + ' — ' + fmtTime(activeStart);
        elapsedInterval = window.setInterval(updateElapsed, 1000);
        updateElapsed();
    }
    else {
        const end = new Date();
        if (elapsedInterval !== null)
            clearInterval(elapsedInterval);
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
        if (siLabel)
            siLabel.textContent = t('session_waiting');
        if (siTime)
            siTime.textContent = '--:--:--';
        if (siElapsed)
            siElapsed.textContent = '';
        openDebrief();
    }
}
function openDebrief() {
    if (!pendingSession)
        return;
    const num = sessions.length + 1;
    document.getElementById('debrief-num').textContent = t('debrief_flight_num', { num: pad(num) });
    document.getElementById('debrief-dur').textContent = durLabel(pendingSession.durationMin);
    const tStart = new Date(pendingSession.startTs);
    const tEnd = new Date(pendingSession.endTs);
    const timesEl = document.getElementById('debrief-times');
    if (timesEl)
        timesEl.textContent = fmtDate(tStart) + '  •  ' + pad(tStart.getHours()) + ':' + pad(tStart.getMinutes()) + ' → ' + pad(tEnd.getHours()) + ':' + pad(tEnd.getMinutes());
    document.getElementById('debrief-name').value = '';
    document.getElementById('debrief-notes').value = '';
    const picker = document.getElementById('debrief-aircraft-picker');
    if (picker)
        picker.innerHTML = renderAircraftPickerHtml([]);
    const mwrap = document.getElementById('debrief-mission-picker-wrap');
    if (mwrap)
        mwrap.innerHTML = renderMissionPickerHtml(0, []);
    document.getElementById('debrief-overlay').classList.add('open');
    setTimeout(() => document.getElementById('debrief-name').focus(), 50);
}
async function confirmDebrief() {
    if (!pendingSession)
        return;
    pendingSession.name = document.getElementById('debrief-name').value.trim() || undefined;
    pendingSession.notes = document.getElementById('debrief-notes').value.trim() || undefined;
    pendingSession.aircraft = Array.from(document.querySelectorAll('#debrief-aircraft-picker .aircraft-toggle.selected')).map(el => el.dataset.aircraft).filter(Boolean);
    if (!pendingSession.aircraft.length)
        pendingSession.aircraft = undefined;
    const mt = Array.from(document.querySelectorAll('#emission-tags-0 [data-mission]')).map(el => el.dataset.mission).filter(Boolean);
    pendingSession.missionTypes = mt.length ? mt : undefined;
    sessions.unshift(pendingSession);
    pendingSession = null;
    document.getElementById('debrief-overlay').classList.remove('open');
    renderSessions();
    updateTotal();
    await saveToFile();
}
async function skipDebrief() {
    if (!pendingSession)
        return;
    sessions.unshift(pendingSession);
    pendingSession = null;
    document.getElementById('debrief-overlay').classList.remove('open');
    renderSessions();
    updateTotal();
    await saveToFile();
}
function deleteDebrief() {
    pendingSession = null;
    document.getElementById('debrief-overlay').classList.remove('open');
}
function updateElapsed() {
    if (!activeStart)
        return;
    const el = document.getElementById('si-elapsed');
    if (el)
        el.textContent = '⏱ ' + secsToHMS(Math.floor((Date.now() - activeStart.getTime()) / 1000));
    syncBurgerState();
}
// ─── Édition ───────────────────────────────────────────────────────────────
function calcEditDur(id) {
    const dv1 = document.getElementById('edate1-' + id).value;
    const dv2 = document.getElementById('edate2-' + id).value;
    const h1 = parseInt(document.getElementById('eh1-' + id).value) || 0;
    const m1 = parseInt(document.getElementById('em1-' + id).value) || 0;
    const h2 = parseInt(document.getElementById('eh2-' + id).value) || 0;
    const m2 = parseInt(document.getElementById('em2-' + id).value) || 0;
    if (!dv1 || !dv2)
        return null;
    const start = new Date(dv1 + 'T' + pad(h1) + ':' + pad(m1));
    const end = new Date(dv2 + 'T' + pad(h2) + ':' + pad(m2));
    const dur = (end.getTime() - start.getTime()) / 60000;
    if (dur <= 0)
        return null;
    return { start, end, dur };
}
function updateEditResult(id) {
    const res = calcEditDur(id);
    const el = document.getElementById('res-dur-' + id);
    if (el)
        el.textContent = res ? durLabel(res.dur) : '--';
}
// ─── Rendu sessions ────────────────────────────────────────────────────────
function renderSessions() {
    const list = document.getElementById('sessions-list');
    const sc = document.getElementById('session-count');
    const query = (document.getElementById('search-input')?.value ?? '').trim().toLowerCase();
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
                || (s.notes?.toLowerCase().includes(query) ?? false);
        })
        : numbered;
    sc.textContent = t('history_count', { count: sessions.length, duration: minsToHM(totalSAMin()) });
    if (!filtered.length) {
        list.innerHTML = `<div id="empty-msg">${t('history_no_results')}</div>`;
        return;
    }
    list.innerHTML = filtered.map(({ s, num }) => {
        const start = new Date(s.startTs);
        const end = new Date(s.endTs);
        const nameLine = s.name ? `<div class="s-name">${escapeHtml(s.name)}</div>` : '';
        const notesBadge = s.notes ? `<div class="row s-note-badge">${t('card_notes_badge')}</div>` : '';
        const aircraftRow = s.aircraft?.length ? `<div class="s-aircraft-row">${s.aircraft.map(a => `<span class="s-aircraft-tag">${escapeHtml(a)}</span>`).join('')}</div>` : '';
        const missionRow = s.missionTypes?.length ? `<div class="s-aircraft-row">${s.missionTypes.map(mt => `<span class="s-mission-tag" data-mission="${escapeHtml(mt)}">${escapeHtml(mt)}</span>`).join('')}</div>` : '';
        const notesFull = s.notes
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
          <label class="edit-block-label">${t('edit_aircraft')}</label>
          <div id="eaircraft-${s.id}" class="aircraft-picker-scroll">${renderAircraftPickerHtml(s.aircraft ?? [])}</div>
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
function toggleCard(id) {
    const card = document.getElementById('sc-' + id);
    const details = document.getElementById('details-' + id);
    const editRow = document.getElementById('edit-' + id);
    const isOpen = card.classList.contains('expanded');
    if (isOpen) {
        card.classList.remove('expanded', 'editing');
        details.style.display = 'none';
        editRow.style.display = 'none';
    }
    else {
        card.classList.add('expanded');
        details.style.display = 'block';
    }
}
function toggleEdit(id) {
    if (editingCardId !== null && editingCardId !== id) {
        checkCardEditing(() => toggleEdit(id));
        return;
    }
    const row = document.getElementById('edit-' + id);
    const card = document.getElementById('sc-' + id);
    if (row.style.display === 'flex') {
        row.style.display = 'none';
        card.classList.remove('editing');
        editingCardId = null;
    }
    else {
        card.classList.add('expanded', 'editing');
        document.getElementById('details-' + id).style.display = 'none';
        row.style.display = 'flex';
        editingCardId = id;
        setTimeout(() => {
            const ta = document.getElementById('enotes-' + id);
            if (ta) {
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
            }
        }, 0);
    }
}
function cancelEdit(id) {
    if (editingCardId === id)
        editingCardId = null;
    renderSessions();
}
async function saveEdit(id) {
    const res = calcEditDur(id);
    if (!res)
        return;
    const idx = sessions.findIndex(s => s.id === id);
    if (idx < 0)
        return;
    sessions[idx].startTs = res.start.getTime();
    sessions[idx].endTs = res.end.getTime();
    sessions[idx].durationMin = res.dur;
    sessions[idx].name = document.getElementById('ename-' + id).value.trim() || undefined;
    sessions[idx].notes = document.getElementById('enotes-' + id).value.trim() || undefined;
    const ac = Array.from(document.querySelectorAll(`#eaircraft-${id} .aircraft-toggle.selected`)).map(el => el.dataset.aircraft).filter(Boolean);
    sessions[idx].aircraft = ac.length ? ac : undefined;
    const mt = Array.from(document.querySelectorAll(`#emission-tags-${id} [data-mission]`)).map(el => el.dataset.mission).filter(Boolean);
    sessions[idx].missionTypes = mt.length ? mt : undefined;
    if (editingCardId === id)
        editingCardId = null;
    renderSessions();
    updateTotal();
    await saveToFile();
}
async function deleteSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    renderSessions();
    updateTotal();
    await saveToFile();
}
function getCardChanges(id) {
    const session = sessions.find(s => s.id === id);
    if (!session)
        return [];
    const changes = [];
    const name = document.getElementById('ename-' + id)?.value.trim() || undefined;
    if (name !== (session.name || undefined))
        changes.push(t('change_name', { from: session.name || '—', to: name || '—' }));
    const notes = document.getElementById('enotes-' + id)?.value.trim() || undefined;
    if (notes !== (session.notes || undefined))
        changes.push(t('change_comment'));
    const ac = Array.from(document.querySelectorAll(`#eaircraft-${id} .aircraft-toggle.selected`)).map(el => el.dataset.aircraft).filter(Boolean);
    const savedAc = session.aircraft || [];
    const acAdd = ac.filter(a => !savedAc.includes(a)), acRem = savedAc.filter(a => !ac.includes(a));
    if (acAdd.length)
        changes.push(t('change_aircraft_added', { list: acAdd.join(', ') }));
    if (acRem.length)
        changes.push(t('change_aircraft_removed', { list: acRem.join(', ') }));
    const mt = Array.from(document.querySelectorAll(`#emission-tags-${id} [data-mission]`)).map(el => el.dataset.mission).filter(Boolean);
    const savedMt = session.missionTypes || [];
    const mtAdd = mt.filter(t2 => !savedMt.includes(t2)), mtRem = savedMt.filter(t2 => !mt.includes(t2));
    if (mtAdd.length)
        changes.push(t('change_mission_added', { list: mtAdd.join(', ') }));
    if (mtRem.length)
        changes.push(t('change_mission_removed', { list: mtRem.join(', ') }));
    const res = calcEditDur(id);
    if (res && (Math.abs(res.start.getTime() - session.startTs) > 59000 || Math.abs(res.end.getTime() - session.endTs) > 59000))
        changes.push(t('change_times'));
    return changes;
}
function checkCardEditing(_nav) {
    if (editingCardId === null)
        return false;
    const row = document.getElementById('edit-' + editingCardId);
    if (!row || row.style.display === 'none') {
        editingCardId = null;
        return false;
    }
    const changes = getCardChanges(editingCardId);
    if (!changes.length) {
        cancelEdit(editingCardId);
        return false;
    }
    const num = pad(sessions.findIndex(s => s.id === editingCardId) >= 0 ? sessions.length - sessions.findIndex(s => s.id === editingCardId) : 0);
    const msg = document.getElementById('card-confirm-msg');
    msg.innerHTML = t('confirm_card', { num, changes: changes.join('<br>') });
    document.getElementById('card-confirm-overlay').style.display = 'flex';
    return true;
}
function confirmCardLeave(save) {
    document.getElementById('card-confirm-overlay').style.display = 'none';
    if (save === null)
        return;
    const id = editingCardId;
    if (id === null)
        return;
    editingCardId = null;
    if (save)
        saveEdit(id);
    else
        cancelEdit(id);
}
// ─── Profil ────────────────────────────────────────────────────────────────
function updateProfileBtn() {
    const btn = document.getElementById('profile-btn');
    if (!btn)
        return;
    const src = profile.avatar
        ? profile.avatar
        : (() => { const svg = generateBoringAvatar(profile.name || 'pilot', 32); return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); })();
    btn.innerHTML = `<img src="${src}" alt="profil" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
}
function hidAllPages() {
    document.getElementById('main').style.display = 'none';
    document.getElementById('profile-page').style.display = 'none';
    document.getElementById('new-flight-page').style.display = 'none';
    document.getElementById('settings-page').style.display = 'none';
    ['nav-historique', 'nav-new-flight', 'nav-settings'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.getElementById('profile-btn')?.classList.remove('active');
}
function showProfile() {
    if (checkCardEditing(() => showProfile()))
        return;
    if (checkNewFlight(() => showProfile()))
        return;
    if (checkSettingsDirty(() => showProfile()))
        return;
    hidAllPages();
    document.getElementById('profile-page').style.display = 'flex';
    document.getElementById('profile-btn')?.classList.add('active');
    renderProfileView();
}
function hideProfile() {
    showHistorique();
}
function showHistorique() {
    if (checkNewFlight(() => showHistorique()))
        return;
    if (checkProfileEditing(() => showHistorique()))
        return;
    if (checkSettingsDirty(() => showHistorique()))
        return;
    hidAllPages();
    document.getElementById('main').style.display = '';
    document.getElementById('nav-historique')?.classList.add('active');
    document.getElementById('burger-historique')?.classList.add('active');
    closeBurger();
}
function showSettings() {
    if (checkCardEditing(() => showSettings()))
        return;
    if (checkNewFlight(() => showSettings()))
        return;
    if (checkProfileEditing(() => showSettings()))
        return;
    if (checkSettingsDirty(() => showSettings()))
        return;
    hidAllPages();
    document.getElementById('settings-page').style.display = 'flex';
    document.getElementById('nav-settings')?.classList.add('active');
    const expCb = document.getElementById('st-export-profile');
    const impCb = document.getElementById('st-import-profile');
    if (expCb)
        expCb.checked = !!profile.exportProfile;
    if (impCb)
        impCb.checked = !!profile.importProfile;
    settingsDirty = false;
}
function onSettingChange() {
    settingsDirty = true;
}
function saveSettings() {
    profile.exportProfile = document.getElementById('st-export-profile').checked;
    profile.importProfile = document.getElementById('st-import-profile').checked;
    settingsDirty = false;
    saveToFile();
}
function cancelSettings() {
    document.getElementById('st-export-profile').checked = !!profile.exportProfile;
    document.getElementById('st-import-profile').checked = !!profile.importProfile;
    settingsDirty = false;
}
function getSettingsChanges() {
    const changes = [];
    const exp = document.getElementById('st-export-profile')?.checked;
    const imp = document.getElementById('st-import-profile')?.checked;
    if (exp !== !!profile.exportProfile)
        changes.push(t('change_setting_export', { state: exp ? t('change_enabled') : t('change_disabled') }));
    if (imp !== !!profile.importProfile)
        changes.push(t('change_setting_import', { state: imp ? t('change_enabled') : t('change_disabled') }));
    return changes;
}
function getProfileChanges() {
    const changes = [];
    const nameEl = document.getElementById('pf-name-input');
    if (nameEl && nameEl.value.trim() !== profile.name)
        changes.push(t('change_name', { from: profile.name || '—', to: nameEl.value.trim() || '—' }));
    const selected = new Set(Array.from(document.querySelectorAll('.pf-module-toggle.selected')).map(el => el.dataset.module).filter(Boolean));
    const saved = new Set(profile.modules);
    const added = [...selected].filter(m => !saved.has(m));
    const removed = [...saved].filter(m => !selected.has(m));
    if (added.length)
        changes.push(t('change_modules_added', { list: added.join(', ') }));
    if (removed.length)
        changes.push(t('change_modules_removed', { list: removed.join(', ') }));
    return changes;
}
function checkProfileEditing(_nav) {
    if (!profileEditing || document.getElementById('profile-page').style.display === 'none')
        return false;
    const changes = getProfileChanges();
    if (!changes.length) {
        cancelEditProfile();
        return false;
    }
    const msg = document.getElementById('pf-confirm-msg');
    msg.innerHTML = t('confirm_profile', { changes: changes.join('<br>') });
    document.getElementById('pf-confirm-overlay').style.display = 'flex';
    return true;
}
function confirmProfileLeave(save) {
    document.getElementById('pf-confirm-overlay').style.display = 'none';
    if (save === null)
        return;
    if (save)
        saveProfile();
    else
        cancelEditProfile();
}
function isNewFlightDirty() {
    const name = document.getElementById('nf-name')?.value.trim();
    const notes = document.getElementById('nf-notes')?.value.trim();
    const ac = document.querySelectorAll('#nf-aircraft-picker .aircraft-toggle.selected').length;
    const mt = document.querySelectorAll('#emission-tags--1 [data-mission]').length;
    return !!(name || notes || ac || mt);
}
function getNewFlightChanges() {
    const changes = [];
    const name = document.getElementById('nf-name')?.value.trim();
    if (name)
        changes.push(t('change_flight_name', { name }));
    const mt = Array.from(document.querySelectorAll('#emission-tags--1 [data-mission]')).map(el => el.dataset.mission).filter(Boolean);
    if (mt.length)
        changes.push(t('change_missions', { list: mt.join(', ') }));
    const ac = Array.from(document.querySelectorAll('#nf-aircraft-picker .aircraft-toggle.selected')).map(el => el.dataset.aircraft).filter(Boolean);
    if (ac.length)
        changes.push(t('change_aircraft', { list: ac.join(', ') }));
    const notes = document.getElementById('nf-notes')?.value.trim();
    if (notes)
        changes.push(t('change_comment_filled'));
    return changes;
}
function checkNewFlight(_nav) {
    const page = document.getElementById('new-flight-page');
    if (!page || page.style.display === 'none')
        return false;
    if (!isNewFlightDirty())
        return false;
    const changes = getNewFlightChanges();
    const msg = document.getElementById('nf-confirm-msg');
    msg.innerHTML = changes.length
        ? t('confirm_new_flight_changes', { changes: changes.join('<br>') })
        : t('confirm_new_flight_unsaved');
    document.getElementById('nf-confirm-overlay').style.display = 'flex';
    return true;
}
function confirmNewFlightLeave(save) {
    document.getElementById('nf-confirm-overlay').style.display = 'none';
    if (save === null)
        return;
    if (save)
        saveNewFlight();
}
function checkSettingsDirty(_nav) {
    if (!settingsDirty || document.getElementById('settings-page').style.display === 'none')
        return false;
    const changes = getSettingsChanges();
    const msg = document.getElementById('st-confirm-msg');
    msg.innerHTML = changes.length
        ? t('confirm_settings_changes', { changes: changes.join('<br>') })
        : t('confirm_settings_unsaved');
    document.getElementById('st-confirm-overlay').style.display = 'flex';
    return true;
}
function confirmSettingsLeave(save) {
    document.getElementById('st-confirm-overlay').style.display = 'none';
    if (save === null)
        return;
    if (save)
        saveSettings();
    else
        cancelSettings();
}
function toggleSection(titleEl) {
    titleEl.closest('.st-section')?.classList.toggle('collapsed');
}
function showNewFlight() {
    if (checkCardEditing(() => showNewFlight()))
        return;
    if (checkProfileEditing(() => showNewFlight()))
        return;
    if (checkSettingsDirty(() => showNewFlight()))
        return;
    hidAllPages();
    document.getElementById('new-flight-page').style.display = 'flex';
    document.getElementById('nav-new-flight')?.classList.add('active');
    const today = fmtDateInput(new Date());
    document.getElementById('nf-date1').value = today;
    document.getElementById('nf-date2').value = today;
    document.getElementById('nf-h1').value = '0';
    document.getElementById('nf-m1').value = '0';
    document.getElementById('nf-h2').value = '0';
    document.getElementById('nf-m2').value = '0';
    document.getElementById('nf-name').value = '';
    document.getElementById('nf-notes').value = '';
    const mwrap = document.getElementById('nf-mission-picker-wrap');
    if (mwrap)
        mwrap.innerHTML = renderMissionPickerHtml(-1, []);
    const apicker = document.getElementById('nf-aircraft-picker');
    if (apicker)
        apicker.innerHTML = renderAircraftPickerHtml([]);
    updateNewFlightResult();
}
function updateNewFlightResult() {
    const d1 = document.getElementById('nf-date1').value;
    const d2 = document.getElementById('nf-date2').value;
    const h1 = parseInt(document.getElementById('nf-h1').value) || 0;
    const m1 = parseInt(document.getElementById('nf-m1').value) || 0;
    const h2 = parseInt(document.getElementById('nf-h2').value) || 0;
    const m2 = parseInt(document.getElementById('nf-m2').value) || 0;
    const el = document.getElementById('nf-duration');
    if (!el)
        return;
    if (!d1 || !d2) {
        el.textContent = '—';
        return;
    }
    const start = new Date(`${d1}T${pad(h1)}:${pad(m1)}:00`);
    const end = new Date(`${d2}T${pad(h2)}:${pad(m2)}:00`);
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    el.textContent = dur > 0 ? durLabel(dur) : '—';
}
async function saveNewFlight() {
    const d1 = document.getElementById('nf-date1').value;
    const d2 = document.getElementById('nf-date2').value;
    if (!d1 || !d2)
        return;
    const h1 = parseInt(document.getElementById('nf-h1').value) || 0;
    const m1 = parseInt(document.getElementById('nf-m1').value) || 0;
    const h2 = parseInt(document.getElementById('nf-h2').value) || 0;
    const m2 = parseInt(document.getElementById('nf-m2').value) || 0;
    const start = new Date(`${d1}T${pad(h1)}:${pad(m1)}:00`);
    const end = new Date(`${d2}T${pad(h2)}:${pad(m2)}:00`);
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    if (dur <= 0)
        return;
    const name = document.getElementById('nf-name').value.trim() || undefined;
    const notes = document.getElementById('nf-notes').value.trim() || undefined;
    const ac = Array.from(document.querySelectorAll('#nf-aircraft-picker .aircraft-toggle.selected')).map(el => el.dataset.aircraft).filter(Boolean);
    const mt = Array.from(document.querySelectorAll('#emission-tags--1 [data-mission]')).map(el => el.dataset.mission).filter(Boolean);
    const s = {
        id: Date.now(),
        startTs: start.getTime(),
        endTs: end.getTime(),
        durationMin: dur,
        name,
        notes,
        aircraft: ac.length ? ac : undefined,
        missionTypes: mt.length ? mt : undefined,
    };
    sessions.unshift(s);
    renderSessions();
    updateTotal();
    await saveToFile();
    showNewFlight();
    const msg = document.getElementById('nf-save-msg');
    if (msg) {
        msg.style.opacity = '1';
        setTimeout(() => msg.style.opacity = '0', 1500);
    }
}
function toggleBurger() {
    document.getElementById('burger-menu')?.classList.toggle('open');
    syncBurgerState();
}
function closeBurger() {
    document.getElementById('burger-menu')?.classList.remove('open');
}
function syncBurgerState() {
    const siLabel = document.getElementById('si-label')?.textContent ?? '';
    const siTime = document.getElementById('si-time')?.textContent ?? '';
    const siElapsed = document.getElementById('si-elapsed')?.textContent ?? '';
    const btnText = document.getElementById('btn-toggle')?.textContent ?? '';
    const bLabel = document.getElementById('burger-si-label');
    const bTime = document.getElementById('burger-si-time');
    const bElap = document.getElementById('burger-si-elapsed');
    const bBtn = document.getElementById('burger-btn-toggle');
    if (bLabel)
        bLabel.textContent = siLabel;
    if (bTime)
        bTime.textContent = siTime;
    if (bElap)
        bElap.textContent = siElapsed;
    if (bBtn)
        bBtn.textContent = btnText;
    const active = document.getElementById('btn-toggle')?.classList.contains('active');
    if (active)
        bBtn?.classList.add('active');
    else
        bBtn?.classList.remove('active');
}
function syncBurgerSearch() {
    const val = document.getElementById('burger-search').value;
    document.getElementById('search-input').value = val;
    renderSessions();
}
function getEffectiveOwnedModuleNames() {
    const owned = new Set(profile.modules);
    DCS_MODULES.forEach(mod => {
        if (owned.has(mod.name) && mod.includes)
            mod.includes.forEach(inc => owned.add(inc));
    });
    return owned;
}
function missionTagHtml(id, type) {
    return `<span class="mission-tag" data-mission="${escapeHtml(type)}">${escapeHtml(type)}<button type="button" class="mission-tag-remove" onclick="removeMissionType(${id},'${escapeHtml(type)}')"><img src="./icons/close.png" alt="×"></button></span>`;
}
function renderMissionPickerHtml(id, selected) {
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
function addCustomMissionType(id) {
    const input = document.getElementById(`emission-custom-${id}`);
    if (!input)
        return;
    const val = input.value.trim();
    if (!val)
        return;
    input.value = '';
    const tagsRow = document.getElementById(`emission-tags-${id}`);
    if (!tagsRow)
        return;
    if (tagsRow.querySelector(`[data-mission="${CSS.escape(val)}"]`))
        return;
    tagsRow.insertAdjacentHTML('beforeend', missionTagHtml(id, val));
}
function resizeMissionInput(input) {
    const span = document.createElement('span');
    Object.assign(span.style, { position: 'fixed', top: '-9999px', left: '-9999px', whiteSpace: 'pre', visibility: 'hidden', fontFamily: 'Inter,sans-serif', fontSize: '12px' });
    span.textContent = input.value || input.placeholder;
    document.body.appendChild(span);
    input.style.width = (span.offsetWidth + 12) + 'px';
    document.body.removeChild(span);
}
function toggleMissionPanel(id) {
    document.getElementById(`emission-panel-${id}`)?.classList.toggle('open');
    const input = document.getElementById(`emission-custom-${id}`);
    if (input)
        resizeMissionInput(input);
}
function toggleMissionType(id, type) {
    const chip = document.querySelector(`#emission-panel-${id} [data-mission="${type}"]`);
    if (!chip)
        return;
    const adding = !chip.classList.contains('selected');
    chip.classList.toggle('selected');
    const tagsRow = document.getElementById(`emission-tags-${id}`);
    if (!tagsRow)
        return;
    if (adding) {
        tagsRow.insertAdjacentHTML('beforeend', missionTagHtml(id, type));
    }
    else {
        tagsRow.querySelector(`[data-mission="${type}"]`)?.remove();
    }
}
function removeMissionType(id, type) {
    document.getElementById(`emission-tags-${id}`)?.querySelector(`[data-mission="${type}"]`)?.remove();
    const chip = document.querySelector(`#emission-panel-${id} [data-mission="${type}"]`);
    chip?.classList.remove('selected');
}
function renderAircraftPickerHtml(selected) {
    if (!profile.modules.length)
        return `<span class="pf-empty">${t('profile_no_modules_configured')}</span>`;
    const ownedMods = DCS_MODULES.filter(mod => getEffectiveOwnedModuleNames().has(mod.name));
    const modelsSet = new Set();
    ownedMods.forEach(mod => (mod.variants ?? [mod.name]).forEach(m => modelsSet.add(m)));
    return Array.from(modelsSet).sort().map(model => {
        const sel = selected.includes(model);
        return `<button type="button" class="aircraft-toggle${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')" data-aircraft="${escapeHtml(model)}">${escapeHtml(model)}<img class="aircraft-toggle-close" src="./icons/close.png" alt="×"></button>`;
    }).join('');
}
function avatarHtml(name, avatar, size = 80) {
    if (avatar)
        return `<img class="pf-avatar-img" src="${avatar}" alt="avatar" width="${size}" height="${size}">`;
    const svgRaw = generateBoringAvatar(name || 'pilot', size);
    const b64 = btoa(unescape(encodeURIComponent(svgRaw)));
    return `<img class="pf-avatar-img" src="data:image/svg+xml;base64,${b64}" alt="avatar" width="${size}" height="${size}">`;
}
function renderProfileView() {
    const content = document.getElementById('pf-content');
    const tags = profile.modules.length
        ? profile.modules.map(m => `<span class="pf-module-tag">${escapeHtml(m)}</span>`).join('')
        : `<span class="pf-empty">${t('profile_no_modules')}</span>`;
    content.innerHTML = `
    <div class="pf-view">
      <div class="pf-avatar-section">
        ${avatarHtml(profile.name, profile.avatar, 80)}
        <div class="pf-pilot-name">${profile.name ? escapeHtml(profile.name) : `<span class="pf-empty">${t('profile_name_undefined')}</span>`}</div>
        <button class="btn-sm" onclick="editProfile()">${t('profile_edit_btn')}</button>
      </div>
      <div class="pf-section">
        <div class="pf-section-title">${t('profile_modules_count', { count: profile.modules.length })}</div>
        <div class="pf-modules-display">${tags}</div>
      </div>
    </div>`;
}
function editProfile() {
    profileEditing = true;
    pendingAvatarChange = undefined;
    const content = document.getElementById('pf-content');
    const grid = DCS_MODULES.map(mod => {
        const sel = profile.modules.includes(mod.name);
        return `<button type="button" class="pf-module-toggle${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')" data-module="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</button>`;
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
        <label class="pf-label">${t('profile_modules')}</label>
        <input type="text" id="pf-module-search" class="pf-input" placeholder="${t('profile_module_search')}" oninput="filterModules()">
        <div class="pf-modules-grid">${grid}</div>
      </div>
      <div class="pf-edit-actions">
        <button class="btn-sm" onclick="saveProfile()">${t('profile_save')}</button>
        <button class="btn-sm btn-cancel" onclick="cancelEditProfile()">${t('profile_cancel')}</button>
      </div>
    </div>`;
}
function uploadAvatar(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file)
        return;
    input.value = '';
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const SIZE = 128;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            const s = Math.min(img.width, img.height);
            const ox = (img.width - s) / 2, oy = (img.height - s) / 2;
            ctx.drawImage(img, ox, oy, s, s, 0, 0, SIZE, SIZE);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            pendingAvatarChange = dataUrl;
            profile = { ...profile, avatar: dataUrl };
            updateProfileBtn();
            saveToFile();
            const preview = document.getElementById('pf-avatar-preview');
            if (preview)
                preview.innerHTML = `<img class="pf-avatar-img" src="${dataUrl}" alt="avatar" width="72" height="72">`;
            const wrap = document.getElementById('pf-avatar-remove-wrap');
            if (wrap && !wrap.querySelector('button'))
                wrap.innerHTML = `<button class="btn-sm btn-cancel" onclick="removeAvatar()">${t('profile_delete_photo')}</button>`;
        };
        img.src = e.target?.result;
    };
    reader.readAsDataURL(file);
}
function removeAvatar() {
    const nameVal = document.getElementById('pf-name-input')?.value || profile.name;
    pendingAvatarChange = null;
    const preview = document.getElementById('pf-avatar-preview');
    if (preview)
        preview.innerHTML = avatarHtml(nameVal, undefined, 72);
    const wrap = document.getElementById('pf-avatar-remove-wrap');
    if (wrap)
        wrap.innerHTML = '';
}
function filterModules() {
    const query = document.getElementById('pf-module-search').value.toLowerCase().trim();
    document.querySelectorAll('.pf-module-toggle').forEach(btn => {
        const name = (btn.dataset.module || '').toLowerCase();
        btn.style.display = !query || name.includes(query) ? '' : 'none';
    });
}
function cancelEditProfile() { profileEditing = false; pendingAvatarChange = undefined; renderProfileView(); }
async function saveProfile() {
    profileEditing = false;
    const name = document.getElementById('pf-name-input').value.trim();
    const modules = Array.from(document.querySelectorAll('.pf-module-toggle.selected'))
        .map(el => el.dataset.module).filter(Boolean);
    const avatar = pendingAvatarChange !== undefined
        ? (pendingAvatarChange ?? undefined)
        : profile.avatar;
    pendingAvatarChange = undefined;
    profile = { ...profile, name, modules, avatar };
    updateProfileBtn();
    renderProfileView();
    renderSessions();
    await saveToFile();
}
// ─── i18n refresh ──────────────────────────────────────────────────────────
async function setLanguage(lang) {
    await setLang(lang);
    applyStaticTranslations();
    renderSessions();
    // Timer state
    const siLabel = document.getElementById('si-label');
    if (siLabel)
        siLabel.textContent = activeStart ? t('session_active') : t('session_waiting');
    const btn = document.getElementById('btn-toggle');
    if (btn)
        btn.textContent = activeStart ? t('session_stop') : t('session_start');
    // Save indicator text
    const si = document.getElementById('save-indicator');
    if (si)
        si.textContent = t('save_indicator');
    // Profile page if visible
    const pfPage = document.getElementById('profile-page');
    if (pfPage && pfPage.style.display !== 'none') {
        if (profileEditing)
            editProfile();
        else
            renderProfileView();
    }
    syncBurgerState();
}
// ─── Indicateur de sauvegarde ──────────────────────────────────────────────
document.body.insertAdjacentHTML('beforeend', `<div id="save-indicator">${t('save_indicator')}</div>`);
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
window.toggleCard = toggleCard;
window.confirmDebrief = confirmDebrief;
window.skipDebrief = skipDebrief;
window.deleteDebrief = deleteDebrief;
function handleSearchInput() {
    const mainEl = document.getElementById('main');
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
window.showHistorique = showHistorique;
window.showNewFlight = showNewFlight;
window.updateNewFlightResult = updateNewFlightResult;
window.saveNewFlight = saveNewFlight;
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.cancelSettings = cancelSettings;
window.onSettingChange = onSettingChange;
window.confirmSettingsLeave = confirmSettingsLeave;
window.confirmCardLeave = confirmCardLeave;
window.confirmNewFlightLeave = confirmNewFlightLeave;
window.confirmProfileLeave = confirmProfileLeave;
window.toggleSection = toggleSection;
window.toggleBurger = toggleBurger;
window.toggleMissionPanel = toggleMissionPanel;
window.toggleMissionType = toggleMissionType;
window.removeMissionType = removeMissionType;
window.addCustomMissionType = addCustomMissionType;
window.resizeMissionInput = resizeMissionInput;
window.closeBurger = closeBurger;
window.syncBurgerSearch = syncBurgerSearch;
window.hideProfile = hideProfile;
window.editProfile = editProfile;
window.cancelEditProfile = cancelEditProfile;
window.saveProfile = saveProfile;
window.filterModules = filterModules;
window.uploadAvatar = uploadAvatar;
window.removeAvatar = removeAvatar;
window.setLanguage = setLanguage;
window.tbMinimize = () => getCurrentWindow().minimize();
window.tbMaximize = () => getCurrentWindow().toggleMaximize();
window.tbClose = () => getCurrentWindow().close();
// ─── Démarrage ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    await initI18n();
    await loadFromFile();
    applyStaticTranslations();
    // Set dynamic initial state labels
    const siLabel = document.getElementById('si-label');
    if (siLabel)
        siLabel.textContent = t('session_waiting');
    const btn = document.getElementById('btn-toggle');
    if (btn)
        btn.textContent = t('session_start');
    const si = document.getElementById('save-indicator');
    if (si)
        si.textContent = t('save_indicator');
    updateProfileBtn();
    updateSteamDisplay();
    updateTotal();
    renderSessions();
});
