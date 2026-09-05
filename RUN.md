# Playrun — room-bot local

Solo los pasos verificados. Ejecuta comando a comando, en este orden.

---

## 0. Una sola vez (ya hecho en esta máquina)

```bash
cd ~/Documents/git/room-bot
npm install
gcloud auth application-default login --project recole-485714
```

`.env.local` ya tiene las variables `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` con los
nombres correctos (antes decían `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` y Gmail
quedaba desactivado). No hace falta repetir esto salvo que se pierda `.env.local`.

---

## A. Asignar actividades y niños (dashboard)

**Terminal 1** — dejar corriendo:

```bash
cd ~/Documents/git/room-bot
npm run dev
```

Esperar el log `"msg":"room-bot.started"`.

**Terminal 2** — abrir el dashboard en Chrome:

```bash
cd ~/Documents/git/room-bot
open -a "Google Chrome" "http://localhost:8080/admin/$(grep '^WORKSPACE_ID=' .env.local | cut -d= -f2-)?token=$(grep '^ADMIN_TOKEN=' .env.local | cut -d= -f2-)"
```

En el dashboard: crear evento, "Asignar estudiantes", "+ Agregar items", "Reemplazar" si
un papá no puede cumplir. Los cambios se guardan directo en Firestore.

Para la otra clase, cambia `pgma` por `pka` en la barra de direcciones del navegador
(mismo servidor, no hace falta reiniciar nada).

Cuando termines, `Ctrl+C` en la Terminal 1.

---

## B. Generar el mensaje semanal (para copiar y enviar a Paulina)

```bash
cd ~/Documents/git/room-bot
npx tsx --env-file=.env.local scripts/print-weekly-message.ts pgma
```

Esto lee Firestore (eventos de la próxima semana lunes→domingo, alumnos, ejemplos de
voz), lee los correos de `no.reply@lintac.cl` de los últimos 7 días, y genera el mensaje
con Claude. Lo imprime en consola bajo `=== MENSAJE PARA COPIAR Y ENVIAR ===`.

Copia ese texto y pégalo manualmente en WhatsApp (a Paulina o al grupo). El script no
envía nada — es solo lectura y generación.

Para la otra clase:

```bash
cd ~/Documents/git/room-bot
npx tsx --env-file=.env.local scripts/print-weekly-message.ts pka
```

Si imprime `Claude dice SKIP — no hay contenido para este periodo.`, no hay eventos
cargados para esa semana en el dashboard (paso A).

---

## Bloqueado por ahora — no ejecutar

El envío automático por WhatsApp (`POST /remind/generate`, botones de aprobación,
`npm run send-test`, `npm run wa-login`) necesita descargar la sesión de WhatsApp desde
un bucket de Cloud Storage. Eso falla hoy con:

```
The billing account for the owning project is disabled in state closed
```

Las dos cuentas de facturación de la organización (`013EED-5108D9-5D5967` y
`019F3D-BD096C-6755D9`) están cerradas. Firestore no se ve afectado (por eso el paso A
funciona), pero Cloud Storage sí bloquea la descarga de archivos.

Arreglo (fuera de este repo, en la consola de Google):

```bash
open "https://console.cloud.google.com/billing/linkedaccount?project=recole-485714"
```

Reactiva una cuenta de facturación o vincula una nueva. Una vez resuelto, el flujo B se
puede reemplazar por el envío automático — avísame y actualizo este archivo.
