import { Firestore } from '@google-cloud/firestore';
import { serve } from '@hono/node-server';
import { EnvSchema } from './config/schema.js';
import { createRoutes } from './web/routes.js';
import { childLogger } from './utils/logger.js';

const log = childLogger('main');

const envResult = EnvSchema.safeParse(process.env);
if (!envResult.success) {
  log.error({ issues: envResult.error.issues }, 'invalid environment variables');
  process.exit(1);
}

const env = envResult.data;
const db = new Firestore({ projectId: env.GCP_PROJECT_ID });

const app = createRoutes({
  db,
  apiKey: env.ANTHROPIC_API_KEY,
  waBucket: env.WA_AUTH_BUCKET,
  defaultWorkspaceId: env.WORKSPACE_ID,
  adminToken: env.ADMIN_TOKEN,
  gmailClientId: env.GMAIL_CLIENT_ID,
  gmailClientSecret: env.GMAIL_CLIENT_SECRET,
  gmailRefreshToken: env.GMAIL_REFRESH_TOKEN,
});

const port = Number(env.PORT);

serve({ fetch: app.fetch, port }, () => {
  log.info({ port }, 'room-bot.started');
});

process.on('SIGTERM', () => {
  log.info('room-bot.shutdown');
  process.exit(0);
});
