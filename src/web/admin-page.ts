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

  const eventCards = events.length === 0
    ? '<p class="empty">Sin eventos esta semana</p>'
    : events.map((e) => {
        const statusBadge = e.status === 'assigned'
          ? '<span class="status-badge assigned">Asignado</span>'
          : e.status === 'sent'
            ? '<span class="status-badge sent">Enviado</span>'
            : '<span class="status-badge draft">Borrador</span>';

        const itemRows = e.items.length === 0
          ? '<p class="empty">Sin items</p>'
          : e.items.map((item) => {
              const assignedName = item.assignedTo
                ? (studentMap.get(item.assignedTo) ?? item.assignedTo)
                : 'Sin asignar';
              const replaceBtn = item.assignedTo && e.status === 'assigned'
                ? `<button class="btn-replace" onclick="doReplace('${esc(e.id)}','${esc(item.assignedTo)}')">Reemplazar</button>`
                : '';
              return `<li class="item-row">
                <span class="item-name">${esc(item.name)}</span>
                <span class="item-assigned ${item.assignedTo ? 'has-student' : ''}">${esc(assignedName)}</span>
                ${replaceBtn}
              </li>`;
            }).join('\n');

        const assignBtn = e.status === 'draft' && e.items.length > 0
          ? `<button class="btn btn-primary" onclick="doAssign('${esc(e.id)}')">Asignar estudiantes</button>`
          : '';

        const deleteBtn = e.status === 'draft'
          ? `<button class="btn btn-danger" onclick="doDelete('${esc(e.id)}')">Eliminar</button>`
          : '';

        const addItemsBtn = e.status === 'assigned'
          ? `<button class="btn btn-secondary" onclick="toggleAddItems('${esc(e.id)}')">+ Agregar items</button>
             <div id="add-items-${esc(e.id)}" class="add-items-form" style="display:none">
               <div id="new-items-${esc(e.id)}" class="items-builder">
                 <div class="item-input">
                   <input type="text" placeholder="Ej: Jugo, Galletas..." class="new-item-field">
                   <button class="btn-sm btn-remove-item" onclick="removeNewItem(this)">X</button>
                 </div>
               </div>
               <button class="btn-sm btn-add-item" onclick="addNewItem('${esc(e.id)}')" style="margin-top:4px">+ Agregar item</button>
               <br>
               <button class="btn btn-primary" onclick="doAddItems('${esc(e.id)}')" style="margin-top:8px">Guardar y asignar</button>
             </div>`
          : '';

        return `<div class="event-card" id="event-${esc(e.id)}">
          <div class="event-header">
            <span class="event-date">${esc(e.date)}</span>
            <span class="event-type tag-${esc(e.type)}">${esc(e.type)}</span>
            ${statusBadge}
          </div>
          <p class="event-desc">${esc(e.description)}</p>
          <ul class="item-list">${itemRows}</ul>
          ${assignBtn}
          ${addItemsBtn}
          ${deleteBtn}
          <div id="msg-${esc(e.id)}" class="msg"></div>
        </div>`;
      }).join('\n');

  const deferredSection = rotation.deferred.length === 0
    ? ''
    : `<div class="deferred-section">
        <h3>Estudiantes diferidos (prioridad en proximo evento)</h3>
        <ul class="deferred-list">
          ${rotation.deferred.map((id) => {
            const name = studentMap.get(id) ?? id;
            return `<li class="deferred-item">${esc(name)}</li>`;
          }).join('\n')}
        </ul>
      </div>`;

  const rotationRows = rotation.order.map((id, i) => {
    const name = studentMap.get(id) ?? id;
    const isCurrent = i === rotation.currentIndex;
    const isDeferred = rotation.deferred.includes(id);
    let cls = '';
    if (isCurrent) cls = ' current';
    if (isDeferred) cls += ' deferred';
    return `<li class="rot-item${cls}">
      <span class="rot-pos">${i + 1}</span>
      <span class="rot-name">${esc(name)}</span>
      ${isCurrent ? '<span class="rot-badge">Siguiente</span>' : ''}
      ${isDeferred ? '<span class="rot-badge deferred">Diferido</span>' : ''}
    </li>`;
  }).join('\n');

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
    h3 { font-size: 1rem; margin-bottom: 8px; }

    /* Events */
    .event-card {
      background: white; border-radius: 8px; padding: 12px; margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .event-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .event-date { font-weight: 600; font-size: 0.85rem; }
    .event-type {
      font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; text-transform: uppercase;
    }
    .tag-snack { background: #fff3e0; color: #e65100; }
    .tag-material { background: #e3f2fd; color: #1565c0; }
    .tag-activity { background: #f3e5f5; color: #7b1fa2; }
    .tag-info { background: #e0f2f1; color: #00695c; }
    .tag-birthday { background: #fce4ec; color: #c62828; }
    .status-badge {
      font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; font-weight: 700;
      margin-left: auto;
    }
    .status-badge.draft { background: #e0e0e0; color: #616161; }
    .status-badge.assigned { background: #c8e6c9; color: #2e7d32; }
    .status-badge.sent { background: #bbdefb; color: #1565c0; }
    .event-desc { margin-top: 8px; font-size: 0.9rem; }

    /* Items */
    .item-list { list-style: none; margin-top: 8px; }
    .item-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid #f0f0f0;
      font-size: 0.85rem;
    }
    .item-name { font-weight: 600; min-width: 80px; }
    .item-assigned { flex: 1; color: #999; }
    .item-assigned.has-student { color: #1a1a1a; }
    .btn-replace {
      background: #f44336; color: white; border: none; border-radius: 6px;
      padding: 4px 10px; font-size: 0.7rem; font-weight: 600; cursor: pointer;
    }
    .btn-replace:hover { background: #d32f2f; }

    /* Deferred */
    .deferred-section {
      background: #fff8e1; border-radius: 8px; padding: 12px; margin-bottom: 12px;
      border-left: 4px solid #ff9800;
    }
    .deferred-section h3 { font-size: 0.85rem; color: #e65100; margin-bottom: 8px; }
    .deferred-list { list-style: none; }
    .deferred-item { padding: 4px 0; font-size: 0.85rem; }

    /* Rotation */
    .rot-list { list-style: none; }
    .rot-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid #e0e0e0;
      font-size: 0.85rem;
    }
    .rot-item.current { background: #e8f5e9; font-weight: 600; }
    .rot-item.deferred { background: #fff8e1; }
    .rot-pos { color: #999; min-width: 24px; font-size: 0.8rem; }
    .rot-badge {
      background: #25d366; color: white; font-size: 0.65rem; font-weight: 700;
      padding: 2px 6px; border-radius: 10px; margin-left: auto;
    }
    .rot-badge.deferred { background: #ff9800; }

    /* Forms */
    .form-section {
      background: white; border-radius: 8px; padding: 16px; margin-top: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .form-section h3 { font-size: 0.95rem; margin-bottom: 12px; }
    label { display: block; font-size: 0.85rem; color: #555; margin-bottom: 4px; margin-top: 10px; }
    select, input[type="text"], input[type="date"], input[type="number"] {
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
    .btn:disabled { background: #ccc; cursor: not-allowed; }
    .msg { margin-top: 8px; padding: 10px; border-radius: 8px; font-size: 0.9rem; display: none; }
    .msg.success { background: #d4edda; color: #155724; display: block; }
    .msg.error { background: #f8d7da; color: #721c24; display: block; }
    .empty { color: #999; font-size: 0.9rem; padding: 12px 0; }
    .items-builder { margin-top: 8px; }
    .items-builder .item-input {
      display: flex; gap: 8px; margin-bottom: 6px;
    }
    .items-builder input { flex: 1; }
    .btn-sm {
      padding: 6px 12px; font-size: 0.8rem; border: none; border-radius: 6px;
      cursor: pointer; font-weight: 600;
    }
    .btn-add-item { background: #e0e0e0; color: #333; }
    .btn-remove-item { background: #ffcdd2; color: #c62828; min-width: 32px; }
    .btn-danger { background: #f44336; color: white; margin-top: 8px; }
    .btn-danger:hover { background: #d32f2f; }
    .btn-secondary { background: #e0e0e0; color: #333; margin-top: 8px; }
    .btn-secondary:hover { background: #bdbdbd; }
    .add-items-form { margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 6px; border: 1px solid #e0e0e0; }
  </style>
</head>
<body>
  <h1>${esc(config.className)}</h1>
  <p class="subtitle">${esc(config.schoolName)} | ${esc(workspaceId)}</p>

  <h2>Eventos proximos</h2>
  ${deferredSection}
  ${eventCards}

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
      <option value="birthday">Cumpleanos</option>
    </select>
    <label for="evDesc">Descripcion</label>
    <input type="text" id="evDesc" placeholder="Ej: Sharing snack dieciochero">
    <label>Items (cada item se asigna a un estudiante)</label>
    <div id="itemsBuilder" class="items-builder">
      <div class="item-input">
        <input type="text" placeholder="Ej: Jugo, Galletas, Fruta..." class="item-field">
        <button class="btn-sm btn-remove-item" onclick="removeItem(this)">X</button>
      </div>
    </div>
    <button class="btn-sm btn-add-item" onclick="addItem()" style="margin-top:4px">+ Agregar item</button>
    <br>
    <button class="btn btn-primary" onclick="doAddEvent()">Crear evento</button>
    <div id="eventMsg" class="msg"></div>
  </div>

  <h2>Rotacion</h2>
  <p style="font-size:0.85rem;color:#666;margin-bottom:8px">Posicion actual: ${rotation.currentIndex + 1} de ${rotation.order.length}</p>
  <ul class="rot-list">${rotationRows}</ul>

  <div class="form-section">
    <h3>Intercambiar posiciones</h3>
    <label for="swapA">Estudiante A</label>
    <select id="swapA">${studentOptions}</select>
    <label for="swapB">Estudiante B</label>
    <select id="swapB">${studentOptions}</select>
    <button class="btn btn-primary" onclick="doSwap()">Intercambiar</button>
    <div id="swapMsg" class="msg"></div>
  </div>

  <script>
    const W = '${esc(workspaceId)}';
    const T = '${esc(token)}';

    async function api(path, body, method) {
      const m = method || 'POST';
      const res = await fetch(path + '?token=' + T, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: m === 'DELETE' ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      return data;
    }

    function showMsg(id, ok, text) {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'msg ' + (ok ? 'success' : 'error');
      el.textContent = text;
      el.style.display = 'block';
    }

    async function doAssign(eventId) {
      if (!confirm('Asignar estudiantes a este evento?')) return;
      try {
        await api('/admin/' + W + '/event/' + eventId + '/assign', {});
        showMsg('msg-' + eventId, true, 'Estudiantes asignados. Recargando...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { showMsg('msg-' + eventId, false, err.message); }
    }

    async function doReplace(eventId, studentId) {
      if (!confirm('Reemplazar este estudiante? El estudiante enfermo pasa al proximo evento.')) return;
      try {
        await api('/admin/' + W + '/event/' + eventId + '/replace', { studentId });
        showMsg('msg-' + eventId, true, 'Estudiante reemplazado. Recargando...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { showMsg('msg-' + eventId, false, err.message); }
    }

    async function doSwap() {
      const a = document.getElementById('swapA').value;
      const b = document.getElementById('swapB').value;
      if (a === b) { showMsg('swapMsg', false, 'Selecciona dos estudiantes diferentes'); return; }
      try {
        await api('/rotation/swap', { studentA: a, studentB: b, workspaceId: W });
        showMsg('swapMsg', true, 'Posiciones intercambiadas. Recargando...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { showMsg('swapMsg', false, err.message); }
    }

    function addItem() {
      const div = document.createElement('div');
      div.className = 'item-input';
      div.innerHTML = '<input type="text" placeholder="Ej: Jugo, Galletas, Fruta..." class="item-field">'
        + '<button class="btn-sm btn-remove-item" onclick="removeItem(this)">X</button>';
      document.getElementById('itemsBuilder').appendChild(div);
    }

    function removeItem(btn) {
      const container = document.getElementById('itemsBuilder');
      if (container.children.length > 1) {
        btn.parentElement.remove();
      }
    }

    async function doDelete(eventId) {
      if (!confirm('Eliminar este evento? Esta accion no se puede deshacer.')) return;
      try {
        await api('/admin/' + W + '/event/' + eventId, {}, 'DELETE');
        showMsg('msg-' + eventId, true, 'Evento eliminado. Recargando...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { showMsg('msg-' + eventId, false, err.message); }
    }

    function toggleAddItems(eventId) {
      const form = document.getElementById('add-items-' + eventId);
      if (!form) return;
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }

    function addNewItem(eventId) {
      const container = document.getElementById('new-items-' + eventId);
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'item-input';
      div.innerHTML = '<input type="text" placeholder="Ej: Jugo, Galletas..." class="new-item-field">'
        + '<button class="btn-sm btn-remove-item" onclick="removeNewItem(this)">X</button>';
      container.appendChild(div);
    }

    function removeNewItem(btn) {
      const container = btn.parentElement.parentElement;
      if (container.children.length > 1) {
        btn.parentElement.remove();
      }
    }

    async function doAddItems(eventId) {
      const container = document.getElementById('new-items-' + eventId);
      if (!container) return;
      const fields = container.querySelectorAll('.new-item-field');
      const items = [];
      fields.forEach(function(f) {
        const val = f.value.trim();
        if (val) items.push({ name: val });
      });
      if (items.length === 0) { showMsg('msg-' + eventId, false, 'Agrega al menos un item'); return; }
      try {
        await api('/admin/' + W + '/event/' + eventId + '/items', { items });
        showMsg('msg-' + eventId, true, 'Items agregados y asignados. Recargando...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { showMsg('msg-' + eventId, false, err.message); }
    }

    async function doAddEvent() {
      const date = document.getElementById('evDate').value;
      const type = document.getElementById('evType').value;
      const description = document.getElementById('evDesc').value;
      if (!date || !description) { showMsg('eventMsg', false, 'Completa fecha y descripcion'); return; }

      const itemFields = document.querySelectorAll('.item-field');
      const items = [];
      itemFields.forEach(function(f) {
        const val = f.value.trim();
        if (val) items.push({ name: val });
      });

      try {
        await api('/admin/' + W + '/event', { date, type, description, items });
        showMsg('eventMsg', true, 'Evento creado. Recargando...');
        setTimeout(() => location.reload(), 1500);
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
