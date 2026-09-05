import { addDays, format, nextMonday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { ReminderContext } from '../ai/message-generator.js';
import { generateReminder } from '../ai/message-generator.js';
import type { WorkspaceStore } from '../data/firestore.js';
import type { GmailScanner } from '../gmail/scanner.js';
import type { WhatsAppClient } from '../whatsapp/client.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('reminder-weekly');

const SKIP_MARKER = 'SKIP';

export interface WeeklyResult {
  readonly skipped: boolean;
  readonly draftId?: string;
}

export async function runWeeklyReminder(
  store: WorkspaceStore,
  waClient: WhatsAppClient,
  apiKey: string,
  gmailScanner?: GmailScanner,
): Promise<WeeklyResult> {
  const config = await store.getConfig();
  const tz = config.timezone;

  const now = toZonedTime(new Date(), tz);
  const monday = nextMonday(now);
  const sunday = addDays(monday, 6);
  const fromStr = format(monday, 'yyyy-MM-dd');
  const toStr = format(sunday, 'yyyy-MM-dd');

  log.info({ from: fromStr, to: toStr }, 'weekly.generating');

  const [events, students, voiceExamples, schoolEmails] = await Promise.all([
    store.listEventsByDateRange(fromStr, toStr),
    store.listStudents(),
    store.listVoiceExamples(),
    gmailScanner
      ? gmailScanner.fetchSchoolEmails(7).catch((err: unknown) => {
          log.warn({ err: String(err) }, 'gmail.fetch.failed');
          return [];
        })
      : Promise.resolve([]),
  ]);

  const ctx: ReminderContext = {
    reminderType: 'weekly',
    events,
    students,
    voiceExamples,
    className: config.className,
    schoolName: config.schoolName,
    schoolEmails,
    weekRange: `${fromStr} al ${toStr}`,
    today: format(now, 'yyyy-MM-dd'),
  };

  const message = await generateReminder(apiKey, ctx);

  if (message.trim() === SKIP_MARKER) {
    log.info('weekly.skipped.no_content');
    return { skipped: true };
  }

  const draftId = await store.createDraft(message, 'weekly');

  const approveUrl = buildApproveUrl(draftId);
  const preview = `*[room-bot] Resumen semanal:*\n\n${message}\n\n---\nRevisar y enviar: ${approveUrl}`;

  await waClient.connect();
  try {
    if (config.testMode.enabled) {
      await waClient.sendTextToPhone(config.testMode.recipientPhone, preview);
    } else {
      await waClient.sendTextToPhone(getMyPhone(), preview);
    }
  } finally {
    await waClient.disconnect();
  }

  log.info({ draftId }, 'weekly.draft.sent_for_review');
  return { skipped: false, draftId };
}

function buildApproveUrl(draftId: string): string {
  const host = process.env['SERVICE_URL'] ?? `http://localhost:${process.env['PORT'] ?? '8080'}`;
  return `${host}/approve/${draftId}`;
}

function getMyPhone(): string {
  throw new Error('testMode must be enabled — set recipientPhone in workspace config');
}
