import { Firestore } from '@google-cloud/firestore';
import { Hono } from 'hono';
import { WorkspaceStore } from '../data/firestore.js';
import type { EventItem } from '../data/types.js';
import { runDailyReminder } from '../reminders/daily.js';
import { runWeeklyReminder } from '../reminders/weekly.js';
import { GcsAuthStore } from '../whatsapp/auth-store.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { childLogger } from '../utils/logger.js';
import { GmailScanner } from '../gmail/scanner.js';
import { renderAdminPage } from './admin-page.js';
import { renderApprovePage } from './approve-page.js';

const log = childLogger('routes');

interface AppEnv {
  readonly db: Firestore;
  readonly apiKey: string;
  readonly waBucket: string;
  readonly defaultWorkspaceId: string;
  readonly adminToken: string;
  readonly gmailClientId?: string;
  readonly gmailClientSecret?: string;
  readonly gmailRefreshToken?: string;
}

export function createRoutes(env: AppEnv): Hono {
  const app = new Hono();

  const gmailScanner = env.gmailClientId && env.gmailClientSecret && env.gmailRefreshToken
    ? new GmailScanner(env.gmailClientId, env.gmailClientSecret, env.gmailRefreshToken)
    : undefined;

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/remind/generate', async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const reminderType = (body['type'] as string) ?? 'daily';
    const workspaceId = (body['workspaceId'] as string) ?? env.defaultWorkspaceId;

    const store = new WorkspaceStore(env.db, workspaceId);
    const authStore = new GcsAuthStore(env.waBucket, workspaceId);
    const waClient = new WhatsAppClient(authStore);

    try {
      const result = reminderType === 'weekly'
        ? await runWeeklyReminder(store, waClient, env.apiKey, gmailScanner)
        : await runDailyReminder(store, waClient, env.apiKey);

      if (result.skipped) {
        return c.json({ status: 'skipped', reason: 'no content for this period' });
      }

      return c.json({ status: 'draft_sent', draftId: result.draftId });
    } catch (err) {
      log.error({ err: String(err), reminderType }, 'remind.generate.failed');
      return c.json({ error: String(err) }, 500);
    }
  });

  app.get('/approve/:draftId', async (c) => {
    const draftId = c.req.param('draftId');
    const workspaceId = c.req.query('w') ?? env.defaultWorkspaceId;
    const store = new WorkspaceStore(env.db, workspaceId);

    const draft = await store.getDraft(draftId);
    if (!draft) {
      return c.html('<h1>Borrador no encontrado</h1>', 404);
    }

    return c.html(renderApprovePage(draft, workspaceId));
  });

  app.post('/approve/:draftId', async (c) => {
    const draftId = c.req.param('draftId');
    const body = await c.req.json() as { message?: string; workspaceId?: string };
    const workspaceId = body.workspaceId ?? env.defaultWorkspaceId;

    const store = new WorkspaceStore(env.db, workspaceId);
    const draft = await store.getDraft(draftId);

    if (!draft) {
      return c.json({ error: 'Borrador no encontrado' }, 404);
    }

    if (draft.status === 'sent') {
      return c.json({ error: 'Este mensaje ya fue enviado' }, 409);
    }

    const finalMessage = body.message ?? draft.message;

    if (finalMessage !== draft.message) {
      await store.updateDraftMessage(draftId, finalMessage);
    }

    const config = await store.getConfig();
    const authStore = new GcsAuthStore(env.waBucket, workspaceId);
    const waClient = new WhatsAppClient(authStore);

    try {
      await waClient.connect();
      try {
        if (config.testMode.enabled) {
          await waClient.sendTextToPhone(config.testMode.recipientPhone, finalMessage);
        } else {
          await waClient.sendTextToGroup(config.groupJid, finalMessage);
        }
      } finally {
        await waClient.disconnect();
      }

      await store.updateDraftStatus(draftId, 'sent');
      log.info({ draftId, testMode: config.testMode.enabled }, 'approve.sent');

      return c.json({ status: 'sent', draftId });
    } catch (err) {
      log.error({ err: String(err), draftId }, 'approve.send.failed');
      return c.json({ error: String(err) }, 500);
    }
  });

  app.post('/message/adhoc', async (c) => {
    const body = await c.req.json() as { message: string; workspaceId?: string };
    const workspaceId = body.workspaceId ?? env.defaultWorkspaceId;

    if (!body.message) {
      return c.json({ error: 'message is required' }, 400);
    }

    const store = new WorkspaceStore(env.db, workspaceId);
    const config = await store.getConfig();
    const draftId = await store.createDraft(body.message, 'adhoc');

    const authStore = new GcsAuthStore(env.waBucket, workspaceId);
    const waClient = new WhatsAppClient(authStore);

    try {
      await waClient.connect();
      try {
        if (config.testMode.enabled) {
          await waClient.sendTextToPhone(config.testMode.recipientPhone, body.message);
        } else {
          await waClient.sendTextToGroup(config.groupJid, body.message);
        }
      } finally {
        await waClient.disconnect();
      }

      await store.updateDraftStatus(draftId, 'sent');
      log.info({ draftId, testMode: config.testMode.enabled }, 'adhoc.sent');

      return c.json({ status: 'sent', draftId });
    } catch (err) {
      log.error({ err: String(err) }, 'adhoc.send.failed');
      return c.json({ error: String(err) }, 500);
    }
  });

  app.post('/rotation/swap', async (c) => {
    const body = await c.req.json() as {
      studentA: string;
      studentB: string;
      workspaceId?: string;
    };
    const workspaceId = body.workspaceId ?? env.defaultWorkspaceId;

    if (!body.studentA || !body.studentB) {
      return c.json({ error: 'studentA and studentB are required' }, 400);
    }

    const store = new WorkspaceStore(env.db, workspaceId);
    try {
      const newOrder = await store.swapStudents(body.studentA, body.studentB);
      log.info({ studentA: body.studentA, studentB: body.studentB }, 'rotation.swapped');
      return c.json({ status: 'swapped', order: newOrder });
    } catch (err) {
      log.error({ err: String(err) }, 'rotation.swap.failed');
      return c.json({ error: String(err) }, 400);
    }
  });


  // --- Admin dashboard ---

  app.get('/admin/:workspaceId', async (c) => {
    const token = c.req.query('token') ?? '';
    if (token !== env.adminToken) {
      return c.text('No autorizado', 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const store = new WorkspaceStore(env.db, workspaceId);

    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const fromDate = today.toISOString().slice(0, 10);
      const toDate = nextWeek.toISOString().slice(0, 10);

      const [config, students, rotation, events] = await Promise.all([
        store.getConfig(),
        store.listStudents(),
        store.getRotation(),
        store.listEventsByDateRange(fromDate, toDate),
      ]);

      return c.html(renderAdminPage({ workspaceId, config, students, rotation, events, token }));
    } catch (err) {
      log.error({ err: String(err), workspaceId }, 'admin.load.failed');
      return c.text('Error cargando datos: ' + String(err), 500);
    }
  });

  app.post('/admin/:workspaceId/event', async (c) => {
    const token = c.req.query('token') ?? '';
    if (token !== env.adminToken) {
      return c.json({ error: 'No autorizado' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const body = await c.req.json() as {
      date?: string;
      type?: string;
      description?: string;
      items?: EventItem[];
    };

    if (!body.date || !body.description) {
      return c.json({ error: 'date and description are required' }, 400);
    }

    const store = new WorkspaceStore(env.db, workspaceId);
    try {
      const eventId = await store.addEvent({
        date: body.date,
        type: (body.type ?? 'info') as 'snack' | 'material' | 'activity' | 'info',
        description: body.description,
        items: body.items ?? [],
      });
      log.info({ eventId, workspaceId }, 'admin.event.added');
      return c.json({ status: 'added', eventId });
    } catch (err) {
      log.error({ err: String(err) }, 'admin.event.add.failed');
      return c.json({ error: String(err) }, 500);
    }
  });

  app.post('/admin/:workspaceId/event/:eventId/assign', async (c) => {
    const token = c.req.query('token') ?? '';
    if (token !== env.adminToken) {
      return c.json({ error: 'No autorizado' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const eventId = c.req.param('eventId');
    const store = new WorkspaceStore(env.db, workspaceId);

    try {
      const event = await store.assignStudentsToEvent(eventId);
      log.info({ eventId, workspaceId, items: event.items.length }, 'admin.event.assigned');
      return c.json({ status: 'assigned', event });
    } catch (err) {
      log.error({ err: String(err), eventId }, 'admin.event.assign.failed');
      return c.json({ error: String(err) }, 400);
    }
  });

  app.post('/admin/:workspaceId/event/:eventId/replace', async (c) => {
    const token = c.req.query('token') ?? '';
    if (token !== env.adminToken) {
      return c.json({ error: 'No autorizado' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    const eventId = c.req.param('eventId');
    const body = await c.req.json() as { studentId?: string };

    if (!body.studentId) {
      return c.json({ error: 'studentId is required' }, 400);
    }

    const store = new WorkspaceStore(env.db, workspaceId);
    try {
      const result = await store.replaceInEvent(eventId, body.studentId);
      log.info({ eventId, studentId: body.studentId, replacementId: result.replacementId }, 'admin.event.replaced');
      return c.json({ status: 'replaced', replacementId: result.replacementId, event: result.event });
    } catch (err) {
      log.error({ err: String(err), eventId }, 'admin.event.replace.failed');
      return c.json({ error: String(err) }, 400);
    }
  });

  return app;
}
