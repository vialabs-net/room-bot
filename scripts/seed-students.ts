import fs from 'node:fs';
import path from 'node:path';
import { Firestore } from '@google-cloud/firestore';

const PROJECT_ID = process.env['GCP_PROJECT_ID'] ?? 'recole-485714';
const db = new Firestore({ projectId: PROJECT_ID });

interface SeedStudent {
  readonly name: string;
}

interface SeedWorkspace {
  readonly id: string;
  readonly config: {
    readonly groupJid: string;
    readonly timezone: string;
    readonly schoolName: string;
    readonly className: string;
    readonly testMode: {
      readonly enabled: boolean;
      readonly recipientPhone: string;
    };
  };
  readonly students: readonly SeedStudent[];
  readonly rotation: {
    readonly type: string;
    readonly weeklySlots: readonly string[];
  };
}

function loadWorkspaces(): SeedWorkspace[] {
  const filePath = path.resolve('data/workspaces.json');
  if (!fs.existsSync(filePath)) {
    console.error('Missing data/workspaces.json');
    console.error('Copy data/workspaces.example.json to data/workspaces.json and fill in student names.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SeedWorkspace[];
}

function toId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function seedWorkspace(ws: SeedWorkspace): Promise<void> {
  const batch = db.batch();

  // Config
  const configRef = db.doc(`workspaces/${ws.id}/config/main`);
  batch.set(configRef, ws.config);

  // Students
  const studentIds: string[] = [];
  for (const student of ws.students) {
    const id = toId(student.name);
    studentIds.push(id);
    const ref = db.doc(`workspaces/${ws.id}/students/${id}`);
    batch.set(ref, { name: student.name, parents: [] });
  }

  // Rotation
  const rotationRef = db.doc(`workspaces/${ws.id}/rotation/config`);
  batch.set(rotationRef, {
    type: ws.rotation.type,
    order: studentIds,
    currentIndex: 0,
    deferred: [],
    weeklySlots: ws.rotation.weeklySlots,
  });

  await batch.commit();
  console.log(`Seeded workspace "${ws.id}": ${ws.students.length} students`);
}

async function main() {
  const workspaces = loadWorkspaces();
  const target = process.argv[2];

  if (target && target !== 'all') {
    const ws = workspaces.find((w) => w.id === target);
    if (!ws) {
      console.error(`Unknown workspace: ${target}. Available: ${workspaces.map((w) => w.id).join(', ')}`);
      process.exit(1);
    }
    await seedWorkspace(ws);
  } else {
    for (const ws of workspaces) {
      await seedWorkspace(ws);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
