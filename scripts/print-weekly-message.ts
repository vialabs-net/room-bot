// Generates the weekly reminder message (Firestore + Gmail + Claude) and prints it
// to the console, WITHOUT connecting to WhatsApp. Use when GCS/Baileys is unavailable
// (e.g. billing account closed) — copy the printed message and send it manually.
import { addDays, format, nextMonday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Firestore } from '@google-cloud/firestore';
import { EnvSchema } from '../src/config/schema.js';
import { WorkspaceStore } from '../src/data/firestore.js';
import { generateReminder } from '../src/ai/message-generator.js';
import { GmailScanner } from '../src/gmail/scanner.js';

const envResult = EnvSchema.safeParse(process.env);
if (!envResult.success) {
  console.error('Invalid env:', envResult.error.issues);
  process.exit(1);
}
const env = envResult.data;

const workspaceId = process.argv[2] ?? env.WORKSPACE_ID;

const db = new Firestore({ projectId: env.GCP_PROJECT_ID });
const store = new WorkspaceStore(db, workspaceId);

const config = await store.getConfig();
const now = toZonedTime(new Date(), config.timezone);
const monday = nextMonday(now);
const sunday = addDays(monday, 6);
const fromStr = format(monday, 'yyyy-MM-dd');
const toStr = format(sunday, 'yyyy-MM-dd');

console.log(`Workspace: ${workspaceId} (${config.className})`);
console.log(`Rango: ${fromStr} al ${toStr}\n`);

const gmailScanner = env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN
  ? new GmailScanner(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET, env.GMAIL_REFRESH_TOKEN)
  : undefined;

const [events, students, voiceExamples, schoolEmails] = await Promise.all([
  store.listEventsByDateRange(fromStr, toStr),
  store.listStudents(),
  store.listVoiceExamples(),
  gmailScanner
    ? gmailScanner.fetchSchoolEmails(7).catch((err: unknown) => {
        console.warn('gmail.fetch.failed:', String(err));
        return [];
      })
    : Promise.resolve([]),
]);

console.log(`Eventos: ${events.length} | Correos del colegio leidos: ${schoolEmails.length}\n`);

const message = await generateReminder(env.ANTHROPIC_API_KEY, {
  reminderType: 'weekly',
  events,
  students,
  voiceExamples,
  schoolEmails,
  className: config.className,
  schoolName: config.schoolName,
  weekRange: `${fromStr} al ${toStr}`,
  today: format(now, 'yyyy-MM-dd'),
});

if (message.trim() === 'SKIP') {
  console.log('Claude dice SKIP — no hay contenido para este periodo.');
  process.exit(0);
}

console.log('=== MENSAJE PARA COPIAR Y ENVIAR ===\n');
console.log(message);
console.log('\n=====================================');
