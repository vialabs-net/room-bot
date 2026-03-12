import qrcode from 'qrcode-terminal';
import { GcsAuthStore } from '../src/whatsapp/auth-store.js';
import { WhatsAppClient } from '../src/whatsapp/client.js';

const BUCKET = process.env['WA_AUTH_BUCKET'] ?? 'recole-485714-room-bot-wa-auth';
const WORKSPACE_ID = process.argv[2] ?? process.env['WORKSPACE_ID'] ?? 'pgma';

async function main() {
  console.log(`WhatsApp login for workspace: ${WORKSPACE_ID}`);
  console.log(`Auth bucket: ${BUCKET}`);
  console.log('');
  console.log('Scan the QR code with WhatsApp > Linked Devices > Link a Device');
  console.log('');

  const authStore = new GcsAuthStore(BUCKET, WORKSPACE_ID);
  const client = new WhatsAppClient(authStore);

  await client.connectWithQr((qr) => {
    qrcode.generate(qr, { small: true });
  });

  console.log('');
  console.log('Connected! Uploading auth state to GCS...');

  await client.disconnect();

  console.log('Done. WhatsApp session saved to GCS.');
  console.log(`Workspace "${WORKSPACE_ID}" is ready to send messages.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Login failed:', err);
  process.exit(1);
});
