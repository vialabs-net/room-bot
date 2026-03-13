import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

export interface SchoolEmail {
  readonly subject: string;
  readonly date: string; // YYYY-MM-DD
  readonly body: string;
}

const SENDER = 'no.reply@lintac.cl';
const MAX_BODY_CHARS = 3000;

export class GmailScanner {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
  }

  async fetchSchoolEmails(daysBack: number): Promise<SchoolEmail[]> {
    const auth = new google.auth.OAuth2(this.clientId, this.clientSecret);
    auth.setCredentials({ refresh_token: this.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth });
    const query = `from:${SENDER} newer_than:${daysBack}d`;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20,
    });

    const messages = listRes.data.messages ?? [];
    const emails: SchoolEmail[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;

      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers: gmail_v1.Schema$MessagePartHeader[] = full.data.payload?.headers ?? [];
      const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '(sin asunto)';
      const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? '';
      const date = dateHeader ? new Date(dateHeader).toISOString().slice(0, 10) : 'unknown';

      const body = extractBody(full.data.payload).slice(0, MAX_BODY_CHARS);
      if (body) {
        emails.push({ subject, date, body });
      }
    }

    return emails;
  }
}

function extractBody(payload: gmail_v1.Schema$MessagePart | null | undefined): string {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
        return stripHtml(html);
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
