import type { Draft } from '../data/types.js';

export function renderApprovePage(draft: Draft, workspaceId: string): string {
  const escapedMessage = escapeHtml(draft.message);
  const statusLabel = draft.status === 'sent' ? 'Ya enviado' : 'Pendiente de aprobacion';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>room-bot | Revisar mensaje</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5;
      color: #1a1a1a;
      padding: 16px;
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { font-size: 1.2rem; margin-bottom: 8px; }
    .status { font-size: 0.85rem; color: #666; margin-bottom: 16px; }
    .status.sent { color: #25d366; font-weight: bold; }
    textarea {
      width: 100%;
      min-height: 300px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 0.95rem;
      line-height: 1.5;
      resize: vertical;
      font-family: inherit;
    }
    textarea:focus { outline: 2px solid #25d366; border-color: transparent; }
    .actions { margin-top: 16px; display: flex; gap: 12px; }
    button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-send {
      background: #25d366;
      color: white;
      flex: 1;
    }
    .btn-send:hover { background: #1da851; }
    .btn-send:disabled { background: #ccc; cursor: not-allowed; }
    .msg { margin-top: 16px; padding: 12px; border-radius: 8px; display: none; }
    .msg.success { background: #d4edda; color: #155724; display: block; }
    .msg.error { background: #f8d7da; color: #721c24; display: block; }
  </style>
</head>
<body>
  <h1>Revisar mensaje</h1>
  <p class="status${draft.status === 'sent' ? ' sent' : ''}">${statusLabel} | ${draft.reminderType}</p>

  <form id="approveForm" method="POST" action="/approve/${draft.id}">
    <input type="hidden" name="workspaceId" value="${escapeHtml(workspaceId)}">
    <textarea name="message" id="messageInput"${draft.status === 'sent' ? ' disabled' : ''}>${escapedMessage}</textarea>
    <div class="actions">
      ${draft.status === 'sent'
        ? '<button type="button" class="btn-send" disabled>Ya enviado</button>'
        : '<button type="submit" class="btn-send">Enviar al grupo</button>'
      }
    </div>
  </form>

  <div id="result" class="msg"></div>

  <script>
    const form = document.getElementById('approveForm');
    const result = document.getElementById('result');
    const btn = form?.querySelector('button[type="submit"]');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
      result.className = 'msg';
      result.style.display = 'none';

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: document.getElementById('messageInput').value,
            workspaceId: '${escapeHtml(workspaceId)}',
          }),
        });
        const data = await res.json();
        if (res.ok) {
          result.className = 'msg success';
          result.textContent = 'Mensaje enviado al grupo.';
          result.style.display = 'block';
          if (btn) btn.textContent = 'Enviado';
          document.getElementById('messageInput').disabled = true;
        } else {
          throw new Error(data.error || 'Error al enviar');
        }
      } catch (err) {
        result.className = 'msg error';
        result.textContent = err.message;
        result.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar al grupo'; }
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
