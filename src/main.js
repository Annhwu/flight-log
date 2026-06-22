import { getCurrentWindow } from '@tauri-apps/api/window';
async function invoke(cmd, args) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args);
}
// ─── State ─────────────────────────────────────────────────────────────────
let sessions = [];
let steamMinutes = 0;
let activeStart = null;
let elapsedInterval = null;
// ─── Utilitaires ───────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function fmtDate(d) { return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtDateInput(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function minsToHM(m) { const h = Math.floor(m / 60), mm = Math.round(m % 60); return pad(h) + 'h ' + pad(mm) + 'm'; }
function secsToHMS(s) { const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.round(s % 60); return pad(h) + 'h ' + pad(mm) + 'm ' + pad(ss) + 's'; }
function durLabel(min) { const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = Math.round(min % 60); return (d > 0 ? d + 'j ' : '') + pad(h) + 'h ' + pad(m) + 'm'; }
// ─── Sauvegarde automatique via Tauri ──────────────────────────────────────
async function saveToFile() {
    const data = { steamMinutes, sessions };
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
        }
    }
    catch {
        // Pas de fichier existant, on démarre vide
    }
}
function showSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (!el)
        return;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1500);
}
// ─── Export / Import ────────────────────────────────────────────────────────
async function exportJSON() {
    const data = { steamMinutes, sessions };
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
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            steamMinutes = data.steamMinutes ?? 0;
            sessions = data.sessions ?? [];
            await saveToFile();
            updateSteamDisplay();
            updateTotal();
            renderSessions();
        }
        catch {
            alert('Fichier JSON invalide.');
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
        btn.textContent = '■ OFF';
        btn.classList.add('active');
        const siLabel = document.getElementById('si-label');
        const siTime = document.getElementById('si-time');
        if (siLabel)
            siLabel.textContent = 'Session en cours';
        if (siTime)
            siTime.textContent = fmtDate(activeStart) + ' — ' + fmtTime(activeStart);
        elapsedInterval = window.setInterval(updateElapsed, 1000);
        updateElapsed();
    }
    else {
        const end = new Date();
        if (elapsedInterval !== null)
            clearInterval(elapsedInterval);
        sessions.unshift({
            id: Date.now(),
            startTs: activeStart.getTime(),
            endTs: end.getTime(),
            durationMin: (end.getTime() - activeStart.getTime()) / 60000,
        });
        activeStart = null;
        btn.textContent = '▶ ON';
        btn.classList.remove('active');
        const siLabel = document.getElementById('si-label');
        const siTime = document.getElementById('si-time');
        const siElapsed = document.getElementById('si-elapsed');
        if (siLabel)
            siLabel.textContent = 'En attente';
        if (siTime)
            siTime.textContent = '--:--:--';
        if (siElapsed)
            siElapsed.textContent = '';
        renderSessions();
        updateTotal();
        saveToFile();
    }
}
function updateElapsed() {
    if (!activeStart)
        return;
    const el = document.getElementById('si-elapsed');
    if (el)
        el.textContent = '⏱ ' + secsToHMS(Math.floor((Date.now() - activeStart.getTime()) / 1000));
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
    if (!sessions.length) {
        list.innerHTML = '<div id="empty-msg">Aucune session enregistrée <span id="blink">_</span></div>';
        sc.textContent = '';
        return;
    }
    sc.textContent = sessions.length + ' session(s) · ' + minsToHM(totalSAMin());
    list.innerHTML = sessions.map((s, i) => {
        const start = new Date(s.startTs);
        const end = new Date(s.endTs);
        const num = sessions.length - i;
        const notesBadge = s.notes ? `<div class="row s-note-badge">Commentaire du vol</div>` : '';
        const notesPreview = '';
        const notesFull = s.notes
            ? `<div class="s-notes-full">${escapeHtml(s.notes).replace(/\n/g, '<br>')}</div>`
            : `<div class="s-notes-empty">Aucune note pour ce vol.</div>`;
        return `<div class="session-card" id="sc-${s.id}" onclick="toggleCard(${s.id})">
      <div class="s-num">#${pad(num)}</div>
      <div class="s-times">
        <div class="row">Déb&nbsp;<span>${fmtDate(start)} ${pad(start.getHours())}:${pad(start.getMinutes())}</span></div>
        <div class="row">Fin&nbsp;<span>${fmtDate(end)} ${pad(end.getHours())}:${pad(end.getMinutes())}</span></div>
        ${notesBadge}
      </div>
      <div class="s-dur">${durLabel(s.durationMin)}</div>
      <button class="btn-sm" onclick="event.stopPropagation();toggleEdit(${s.id})">Éditer</button>
      <button class="btn-danger" onclick="event.stopPropagation();deleteSession(${s.id})">Supprimer</button>
      ${notesPreview}
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
          <label class="edit-block-label">Notes du vol</label>
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
    const row = document.getElementById('edit-' + id);
    const card = document.getElementById('sc-' + id);
    if (row.style.display === 'flex') {
        row.style.display = 'none';
        card.classList.remove('editing');
    }
    else {
        card.classList.add('expanded', 'editing');
        document.getElementById('details-' + id).style.display = 'none';
        row.style.display = 'flex';
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
    document.getElementById('edit-' + id).style.display = 'none';
    const card = document.getElementById('sc-' + id);
    card.classList.remove('editing');
    document.getElementById('details-' + id).style.display = 'block';
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
    sessions[idx].notes = document.getElementById('enotes-' + id).value.trim() || undefined;
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
window.toggleCard = toggleCard;
window.tbMinimize = () => getCurrentWindow().minimize();
window.tbMaximize = () => getCurrentWindow().toggleMaximize();
window.tbClose = () => getCurrentWindow().close();
// ─── Démarrage ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    await loadFromFile();
    updateSteamDisplay();
    updateTotal();
    renderSessions();
});
