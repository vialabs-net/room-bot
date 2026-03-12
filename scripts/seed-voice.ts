import fs from 'node:fs';
import path from 'node:path';
import { Firestore } from '@google-cloud/firestore';

const PROJECT_ID = process.env['GCP_PROJECT_ID'] ?? 'recole-485714';
const db = new Firestore({ projectId: PROJECT_ID });

interface VoiceSeed {
  readonly content: string;
  readonly messageType: string;
}

function loadVoiceExamples(): VoiceSeed[] {
  const filePath = path.resolve('data/voice-examples.json');
  if (!fs.existsSync(filePath)) {
    console.error('Missing data/voice-examples.json');
    console.error('Copy data/voice-examples.example.json to data/voice-examples.json and fill in your real messages.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as VoiceSeed[];
}

async function main() {
  const workspaceId = process.argv[2] ?? process.env['WORKSPACE_ID'] ?? 'pgma';
  console.log(`Seeding voice examples for workspace: ${workspaceId}`);

  const voiceExamples = loadVoiceExamples();
  const batch = db.batch();

  for (const example of voiceExamples) {
    const ref = db.doc(`workspaces/${workspaceId}/voice/${example.messageType}`);
    batch.set(ref, { content: example.content, messageType: example.messageType });
  }

  await batch.commit();
  console.log(`Seeded ${voiceExamples.length} voice examples.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
