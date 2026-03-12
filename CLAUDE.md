# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## What This Project Does

**room-bot** is a WhatsApp reminder bot for classroom room mothers. It generates AI-enhanced
messages about upcoming activities, snack rotations, and school events, sends them to the room
mother for review, and after approval delivers them to the parents WhatsApp group.

**Author**: Liliana Castellanos | **Site**: https://lilicurl.com

---

## Development Commands

```bash
npm install                          # install dependencies
npm run typecheck                    # tsc --noEmit (strict mode)
npm run build                        # tsc → dist/
npm run dev                          # run locally with tsx
npm run wa-login                     # one-time: scan QR → upload auth to GCS
npm run seed-students                # seed Firestore with student data
npm run seed-voice                   # seed voice examples for AI style reference
npm run send-test                    # send test message to Paulina
```

All scripts use `tsx --env-file=.env.local`. This is an ESM project (`"type": "module"`).
All internal imports use `.js` extensions per NodeNext resolution.

---

## Architecture

```
Cloud Scheduler (America/Santiago)
  ├── Mon-Fri 7:00 PM → POST /remind/generate (daily reminder)
  └── Sunday 10:00 AM → POST /remind/generate (weekly summary)
         │
         Cloud Run (room-bot)
         │
         ├── Download WhatsApp auth state from GCS
         ├── Connect to WhatsApp (Baileys)
         ├── Read class data from Firestore
         ├── Claude generates message (voice examples + event data)
         ├── Store draft in Firestore (status: pending_approval)
         ├── Send draft to room mother's WhatsApp (private)
         ├── Upload updated auth state to GCS
         └── Scale to zero

  Room mother taps approval link → editable review page → "Send" → group
```

---

## GCP Resources (project: recole-485714)

| Resource | Name |
|---|---|
| Cloud Run | `room-bot` |
| Cloud Scheduler | `room-bot-daily`, `room-bot-weekly` |
| Firestore | Native mode, collections under `workspaces/` |
| GCS bucket | `recole-485714-room-bot-wa-auth` |
| Service account | `room-bot-sa@recole-485714.iam.gserviceaccount.com` |

---

## Multi-Tenant Firestore Schema

```
workspaces/{workspaceId}/
  config          → groupJid, timezone, schoolName, className, testMode
  students/{id}   → name, parents [{name, phone}]
  rotation/config → type, order[], currentIndex, weeklySlots[]
  events/{id}     → date, description, assignedTo?, type
  drafts/{id}     → message, status, createdAt, sentAt, reminderType
  voice/{id}      → example messages for AI style reference

wa_auth/{workspaceId}/ → Baileys session credentials (separate, sensitive)
```

---

## Cloud Run Endpoints

| Endpoint | Auth | Trigger |
|---|---|---|
| `POST /remind/generate` | IAM (Cloud Scheduler) | Generate draft, send to room mother |
| `GET /approve/{draftId}` | Public (UUID) | Review page with editable message |
| `POST /approve/{draftId}` | Public (UUID) | Confirm → send to WhatsApp group |
| `POST /message/adhoc` | IAM | Manual custom message |

---

## WhatsApp Integration

Uses `@whiskeysockets/baileys` (same library as openclaw). Auth state persisted in GCS.
One-time QR scan via `npm run wa-login`. Daily connections keep the session alive.

---

## AI Message Generation

- Model: `claude-sonnet-4-6`, max_tokens: 600
- Input: event data + voice examples (room mother's message style)
- Output: one WhatsApp message in warm Chilean Spanish with emojis
- Cost: ~$0.004 per message, ~$0.12/month

---

## Directory Structure

```
room-bot/
├── src/
│   ├── whatsapp/
│   │   ├── client.ts            # Baileys connect, send, disconnect
│   │   └── auth-store.ts        # GCS ↔ local auth state sync
│   ├── data/
│   │   ├── firestore.ts         # CRUD: students, rotation, events, drafts
│   │   └── types.ts             # Student, Rotation, Event, Draft interfaces
│   ├── ai/
│   │   ├── client.ts            # Anthropic SDK wrapper
│   │   └── message-generator.ts # Voice examples + event data → Claude → message
│   ├── reminders/
│   │   ├── daily.ts             # Fetch tomorrow's events → AI → draft
│   │   └── weekly.ts            # Fetch week events → AI → draft
│   ├── web/
│   │   ├── routes.ts            # Hono routes
│   │   └── approve-page.ts      # Simple HTML: textarea + Send button
│   ├── config/
│   │   └── schema.ts            # Zod schemas
│   ├── utils/
│   │   └── logger.ts            # Pino structured logging
│   └── index.ts                 # Cloud Run entry point (Hono)
├── scripts/
│   ├── wa-login.ts              # QR scan → upload auth to GCS
│   ├── seed-students.ts         # Seed class data
│   ├── seed-voice.ts            # Seed message style examples
│   └── send-test.ts             # Test message to Paulina
├── infra/
│   ├── deploy.sh                # gcloud run deploy
│   └── scheduler.sh             # gcloud scheduler jobs create
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── CLAUDE.md
```

---

## Error Handling

- Baileys disconnect: log + retry once, then fail gracefully
- Claude API: 529 → retry with backoff; 4xx → throw immediately
- Firestore: standard GCP SDK error handling
- GCS auth download fails: throw, log, alert (session may need re-auth)

---

## Configuration

- Environment variables via `tsx --env-file=.env.local` locally
- Cloud Run: env vars + Secret Manager for ANTHROPIC_API_KEY
- Workspace config lives in Firestore (not YAML files)
- Timezone: America/Santiago (date-fns-tz, never hardcode UTC offsets)
