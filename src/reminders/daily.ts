import { addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { ReminderContext } from '../ai/message-generator.js';
import { generateReminder } from '../ai/message-generator.js';
import type { WorkspaceStore } from '../data/firestore.js';
import type { WhatsAppClient } from '../whatsapp/client.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('reminder-daily');

const SKIP_MARKER = 'SKIP';

export interface DailyResult {
  readonly skipped: boolean;
  readonly draftId?: string;
}

export async function runDailyReminder(
  store: WorkspaceStore,
  waClient: WhatsAppClient,
  apiKey: string,
): Promise<DailyResult> {
  const config = await store.getConfig();
  const tz = config.timezone;

  const now = toZonedTime(new Date(), tz);
  const tomorrow = addDays(now, 1);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  log.info({ date: tomorrowStr }, 'daily.generating');

  const [events, rotation, students, voiceExamples] = await Promise.all([
    store.listEventsByDateRange(tomorrowStr, tomorrowStr),
    store.getRotation(),
    store.listStudents(),
    store.listVoiceExamples(),
  ]);

  const ctx: ReminderContext = {
    reminderType: 'daily',
    events,
    rotation,
    students,
    voiceExamples,
    className: config.className,
    schoolName: config.schoolName,
  };

  const message = await generateReminder(apiKey, ctx);

  if (message.trim() === SKIP_MARKER) {
    log.info('daily.skipped.no_content');
    return { skipped: true };
  }

  const draftId = await store.createDraft(message, 'daily');

  const approveUrl = buildApproveUrl(draftId);
  const preview = `*[room-bot] Borrador diario:*\n\n${message}\n\n---\nRevisar y enviar: ${approveUrl}`;

  await waClient.connect();
  try {
    if (config.testMode.enabled) {
      await waClient.sendTextToPhone(config.testMode.recipientPhone, preview);
    } else {
      await waClient.sendTextToPhone(getMyPhone(waClient), preview);
    }
  } finally {
    await waClient.disconnect();
  }

  log.info({ draftId }, 'daily.draft.sent_for_review');
  return { skipped: false, draftId };
}

function buildApproveUrl(draftId: string): string {
  const host = process.env['SERVICE_URL'] ?? `http://localhost:${process.env['PORT'] ?? '8080'}`;
  return `${host}/approve/${draftId}`;
}

function getMyPhone(_waClient: WhatsAppClient): string {
  // In production, the room mother's phone is in workspace config.
  // For now, this is handled by testMode — always enabled during development.
  throw new Error('testMode must be enabled — set recipientPhone in workspace config');
}
