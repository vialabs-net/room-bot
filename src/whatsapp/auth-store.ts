import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Storage } from '@google-cloud/storage';
import { childLogger } from '../utils/logger.js';

const log = childLogger('wa-auth-store');

export class GcsAuthStore {
  private readonly storage: Storage;
  private readonly bucket: string;
  private readonly prefix: string;
  private localDir: string | null = null;

  constructor(bucket: string, workspaceId: string) {
    this.storage = new Storage();
    this.bucket = bucket;
    this.prefix = `wa-auth/${workspaceId}/`;
  }

  async download(): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'room-bot-wa-'));
    this.localDir = tmpDir;

    const [files] = await this.storage.bucket(this.bucket).getFiles({ prefix: this.prefix });

    if (files.length === 0) {
      log.info('no existing auth state in GCS, starting fresh');
      return tmpDir;
    }

    await Promise.all(
      files.map(async (file) => {
        const relativePath = file.name.slice(this.prefix.length);
        if (!relativePath) return;
        const localPath = path.join(tmpDir, relativePath);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await file.download({ destination: localPath });
      }),
    );

    log.info({ fileCount: files.length }, 'downloaded auth state from GCS');
    return tmpDir;
  }

  async upload(): Promise<void> {
    if (!this.localDir) {
      throw new Error('No local auth dir — call download() first');
    }

    const files = await listFilesRecursive(this.localDir);

    await Promise.all(
      files.map(async (filePath) => {
        const relativePath = path.relative(this.localDir!, filePath);
        const gcsPath = `${this.prefix}${relativePath}`;
        await this.storage.bucket(this.bucket).upload(filePath, { destination: gcsPath });
      }),
    );

    log.info({ fileCount: files.length }, 'uploaded auth state to GCS');
  }

  async cleanup(): Promise<void> {
    if (!this.localDir) return;
    await fs.rm(this.localDir, { recursive: true, force: true });
    this.localDir = null;
  }

  getLocalDir(): string {
    if (!this.localDir) {
      throw new Error('No local auth dir — call download() first');
    }
    return this.localDir;
  }
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await listFilesRecursive(full)));
    } else {
      paths.push(full);
    }
  }
  return paths;
}
