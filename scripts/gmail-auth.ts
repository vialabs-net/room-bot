// One-time script to obtain a Gmail OAuth2 refresh token.
// Run: npm run gmail-auth
// After running, follow the printed instructions to store the token.

import { google } from 'googleapis';
import * as http from 'node:http';
import { URL } from 'node:url';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const PORT = 3003;
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main(): Promise<void> {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env.local');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force refresh_token to be returned
  });

  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization on http://localhost:3003 ...\n');

  const code = await waitForCode(PORT);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error('\nNo refresh_token in response.');
    console.error('Revoke existing access at https://myaccount.google.com/permissions and run again.');
    process.exit(1);
  }

  const refreshToken = tokens.refresh_token;

  console.log('\n=== Autorizado ===\n');
  console.log('1. Agrega a .env.local:');
  console.log(`   GMAIL_REFRESH_TOKEN=${refreshToken}\n`);
  console.log('2. Guarda en Secret Manager:');
  console.log(`   echo -n "${refreshToken}" | gcloud secrets create gmail-refresh-token --data-file=- --project=recole-485714`);
  console.log(`   echo -n "${clientId}" | gcloud secrets create gmail-client-id --data-file=- --project=recole-485714`);
  console.log(`   echo -n "${clientSecret}" | gcloud secrets create gmail-client-secret --data-file=- --project=recole-485714\n`);
}

function waitForCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (code) {
        res.end('<h2>Autorizado. Puedes cerrar esta ventana.</h2>');
        server.close();
        resolve(code);
      } else {
        res.end(`<h2>Error: ${error ?? 'desconocido'}</h2>`);
        server.close();
        reject(new Error(error ?? 'OAuth error'));
      }
    });

    server.listen(port, () => {});
    server.on('error', reject);
  });
}

main().catch((err: unknown) => {
  console.error('Auth failed:', err);
  process.exit(1);
});
