import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { childLogger } from '../utils/logger.js';
import { GcsAuthStore } from './auth-store.js';

const log = childLogger('wa-client');

type WASocket = ReturnType<typeof makeWASocket>;

export interface SendResult {
  readonly messageId: string;
}

export class WhatsAppClient {
  private readonly authStore: GcsAuthStore;
  private socket: WASocket | null = null;
  private saveCreds: (() => Promise<void>) | null = null;

  constructor(authStore: GcsAuthStore) {
    this.authStore = authStore;
  }

  async connect(): Promise<void> {
    const authDir = await this.authStore.download();
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    this.saveCreds = saveCreds;

    const { version } = await fetchLatestBaileysVersion();
    const baileysLogger = pino({ level: 'silent' });

    this.socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      version,
      logger: baileysLogger,
      printQRInTerminal: false,
      browser: ['room-bot', 'cli', '0.1.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    this.socket.ev.on('creds.update', async () => {
      try {
        await this.saveCreds?.();
      } catch (err) {
        log.warn({ err: String(err) }, 'wa.creds.save.failed');
      }
    });

    await this.waitForConnection();
    log.info('wa.connected');
  }

  async connectWithQr(onQr: (qr: string) => void): Promise<void> {
    const authDir = await this.authStore.download();
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    this.saveCreds = saveCreds;

    const { version } = await fetchLatestBaileysVersion();
    const baileysLogger = pino({ level: 'silent' });

    this.socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      version,
      logger: baileysLogger,
      printQRInTerminal: false,
      browser: ['room-bot', 'cli', '0.1.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    this.socket.ev.on('creds.update', async () => {
      try {
        await this.saveCreds?.();
      } catch (err) {
        log.warn({ err: String(err) }, 'wa.creds.save.failed');
      }
    });

    this.socket.ev.on('connection.update', (update) => {
      if (update.qr) {
        onQr(update.qr);
      }
    });

    await this.waitForConnection();
    log.info('wa.connected');
  }

  async sendTextToGroup(groupJid: string, text: string): Promise<SendResult> {
    if (!this.socket) throw new Error('Not connected — call connect() first');
    const result = await this.socket.sendMessage(groupJid, { text });
    const messageId = result?.key?.id ?? 'unknown';
    log.info({ groupJid, messageId }, 'wa.message.sent.group');
    return { messageId };
  }

  async sendTextToPhone(phone: string, text: string): Promise<SendResult> {
    if (!this.socket) throw new Error('Not connected — call connect() first');
    const jid = phoneToJid(phone);
    const result = await this.socket.sendMessage(jid, { text });
    const messageId = result?.key?.id ?? 'unknown';
    log.info({ phone: maskPhone(phone), messageId }, 'wa.message.sent.direct');
    return { messageId };
  }

  async disconnect(): Promise<void> {
    try {
      await this.authStore.upload();
    } catch (err) {
      log.error({ err: String(err) }, 'wa.auth.upload.failed');
      throw err;
    }

    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }

    await this.authStore.cleanup();
    log.info('wa.disconnected');
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('WhatsApp connection timeout (30s)'));
      }, 30_000);

      this.socket.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
          clearTimeout(timeout);
          resolve();
        }
        if (update.connection === 'close') {
          clearTimeout(timeout);
          const statusCode = getStatusCode(update.lastDisconnect?.error);
          if (statusCode === DisconnectReason.loggedOut) {
            reject(new Error('WhatsApp session logged out — re-run: npm run wa-login'));
          } else {
            reject(new Error(`WhatsApp connection closed (status=${statusCode})`));
          }
        }
      });
    });
  }
}

function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
}

function getStatusCode(err: unknown): number | undefined {
  return (err as { output?: { statusCode?: number } })?.output?.statusCode;
}
