import type { ClassEvent, RotationConfig, Student, WorkspaceConfig } from '../data/types.js';

interface AdminData {
  readonly workspaceId: string;
  readonly config: WorkspaceConfig;
  readonly students: readonly Student[];
  readonly rotation: RotationConfig;
  readonly events: readonly ClassEvent[];
  readonly token: string;
}

export function renderAdminPage(data: AdminData): string {
  const { workspaceId, config, students, rotation, events, token } = data;

  const studentMap = new Map(students.map((s) => [s.id, s.name]));

  const rotationRows = rotation.order.map((id, i) => {
    const name = studentMap.get(id) ?? id;
    const isCurrent = i === rotation.currentIndex;
    return `<li class="rot-item${isCurrent ? ' current' : ''}" data-id="${esc(id)}">
      <span class="rot-pos">${i + 1}</span>
      <span class="rot-name">${esc(name)}</span>
      ${isCurrent ? '<span class="rot-badge">Siguiente</span>' : ''}
    </li>`;
  }).join('\n');

  const eventRows = events.length === 0
    ? '<p class="empty">Sin eventos esta semana</p>'
    : events.map((e) => `<div class="event-card">
        <span class="event-date">${esc(e.date)}</span>
        <span class="event-type tag-${esc(e.type)}">${esc(e.type)}</span>
        <p>${esc(e.description)}</p>
      </div>`).join('\n');

  const studentOptions = students
    .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="room-bot">
  <title>room-bot | ${esc(config.className)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5; color: #1a1a1a;
      padding: 16px; max-width: 600px; margin: 0 auto;
    }
    h1 { font-size: 1.3rem; margin-bottom: 4px; }
    .subtitle { font-size: 0.85rem; color: #666; margin-bottom: 20px; }
    h2 { font-size: 1.1rem; margin: 24px 0 12px; border-bottom: 2px solid #25d366; padding-bottom: 4px; }

    /* Rotation */
    .rot-list { list-style: none; }
    .rot-item {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid #e0e0e0;
      font-size: 0.95rem;
    }
    .rot-item.current { background: #e8f5e9; border-radius: 8px; border-bottom: none; font-weight: 600; }
    .rot-pos { color: #999; min-width: 24px; font-size: 0.8rem; }
    .rot-badge {
      background: #25d366; color: white; font-size: 0.7rem; font-weight: 700;
      padding: 2px 8px; border-radius: 12px; margin-left: auto;
    }

    /* Events */
    .event-card {
      background: white; border-radius: 8px; padding: 12px; margin-bottom: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .event-date { font-weight: 600; font-size: 0.85rem; margin-right: 8px; }
    .event-type {
      font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; text-transform: uppercase;
    }
    .tag-snack { background: #fff3e0; color: #e65100; }
    .tag-material { background: #e3f2fd; color: #1565c0; }
    .tag-activity { background: #f3e5f5; color: #7b1fa2; }
    .tag-info { background: #e0f2f1; color: #00695c; }
    .event-card p { margin-top: 6px; font-size: 0.9rem; }
    .empty { color: #999; font-size: 0.9rem; padding: 12px 0; }

    /* Forms */
    .form-section {
      background: white; border-radius: 8px; padding: 16px; margin-top: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .form-section h3 { font-size: 0.95rem; margin-bottom: 12px; }
    label { display: block; font-size: 0.85rem; color: #555; margin-bottom: 4px; margin-top: 10px; }
    select, input[type="text"], input[type="date"] {
      width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px;
      font-size: 0.95rem; font-family: inherit; background: white;
    }
    select:focus, input:focus { outline: 2px solid #25d366; border-color: transparent; }
    .btn {
      display: inline-block; padding: 10px 20px; border: none; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer; margin-top: 12px;
    }
    .btn-primary { background: #25d366; color: white; }
    .btn-primary:hover { background: #1da851; }
    .btn-warn { background: #ff9800; color: white; }
    .btn-warn:hover { background: #e68900; }
    .btn:disabled { background: #ccc; cursor: not-allowed; }
    .msg { margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 0.9rem; display: none; }
    .msg.success { background: #d4edda; color: #155724; display: block; }
    .msg.error { background: #f8d7da; color: #721c24; display: block; }
  </style>
</head>
<body>
  <h1>${esc(config.className)}</h1>
  <p class="subtitle">${esc(config.schoolName)} | ${esc(workspaceId)}</p>

  <h2>Rotacion de snack</h2>
  <ul class="rot-list">${rotationRows}</ul>

  <div class="form-section">
    <h3>Saltar turno actual</h3>
    <p style="font-size:0.85rem;color:#666;margin-bottom:8px;">Mueve al estudiante actual al final de la lista.</p>
    <button class="btn btn-warn" id="skipBtn" onclick="doSkip()">Saltar turno</button>
    <div id="skipMsg" class="msg"></div>
  </div>

  <div class="form-section">
    <h3>Intercambiar posiciones</h3>
    <label for="swapA">Estudiante A</label>
    <select id="swapA">${studentOptions}</select>
    <label for="swapB">Estudiante B</label>
    <select id="swapB">${studentOptions}</select>
    <button class="btn btn-primary" onclick="doSwap()">Intercambiar</button>
    <div id="swapMsg" class="msg"></div>
  </div>

  <h2>Eventos proximos</h2>
  ${eventRows}

  <div class="form-section">
    <h3>Agregar evento</h3>
    <label for="evDate">Fecha</label>
    <input type="date" id="evDate">
    <label for="evType">Tipo</label>
    <select id="evType">
      <option value="snack">Snack</option>
      <option value="activity">Actividad</option>
      <option value="material">Material</option>
      <option value="info">Informacion</option>
    </select>
    <label for="evDesc">Descripcion</label>
    <input type="text" id="evDesc" placeholder="Ej: Sharing snack dieciochero">
    <button class="btn btn-primary" onclick="doAddEvent()">Agregar</button>
    <div id="eventMsg" class="msg"></div>
  </div>

  <script>
    const W = '${esc(workspaceId)}';
    const T = '${esc(token)}';

    async function api(path, body) {
      const res = await fetch(path + '?token=' + T, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, workspaceId: W }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      return data;
    }

    function showMsg(id, ok, text) {
      const el = document.getElementById(id);
      el.className = 'msg ' + (ok ? 'success' : 'error');
      el.textContent = text;
      el.style.display = 'block';
    }

    async function doSkip() {
      const btn = document.getElementById('skipBtn');
      btn.disabled = true;
      try {
        const data = await api('/rotation/skip', {});
        showMsg('skipMsg', true, 'Turno saltado. Recarga para ver el cambio.');
      } catch (err) { showMsg('skipMsg', false, err.message); }
      btn.disabled = false;
    }

    async function doSwap() {
      const a = document.getElementById('swapA').value;
      const b = document.getElementById('swapB').value;
      if (a === b) { showMsg('swapMsg', false, 'Selecciona dos estudiantes diferentes'); return; }
      try {
        await api('/rotation/swap', { studentA: a, studentB: b });
        showMsg('swapMsg', true, 'Posiciones intercambiadas. Recarga para ver el cambio.');
      } catch (err) { showMsg('swapMsg', false, err.message); }
    }

    async function doAddEvent() {
      const date = document.getElementById('evDate').value;
      const type = document.getElementById('evType').value;
      const description = document.getElementById('evDesc').value;
      if (!date || !description) { showMsg('eventMsg', false, 'Completa fecha y descripcion'); return; }
      try {
        await api('/admin/${esc(workspaceId)}/event', { date, type, description });
        showMsg('eventMsg', true, 'Evento agregado. Recarga para verlo.');
        document.getElementById('evDesc').value = '';
      } catch (err) { showMsg('eventMsg', false, err.message); }
    }
  </script>
</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
