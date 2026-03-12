#!/usr/bin/env bash
# Create Cloud Scheduler jobs for room-bot
# Run: bash infra/scheduler.sh

set -euo pipefail

PROJECT_ID="recole-485714"
REGION="us-central1"
SERVICE_NAME="room-bot"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

if [ -z "${SERVICE_URL}" ]; then
  echo "ERROR: Cloud Run service not found. Deploy first: bash infra/deploy.sh"
  exit 1
fi

echo "=== Creating Cloud Scheduler jobs ==="
echo "Service URL: ${SERVICE_URL}"
echo ""

# Daily reminder — Mon-Fri at 7 PM Chile time
# Generates drafts for both workspaces
echo "Creating daily reminder (Mon-Fri 19:00 CLT)..."

gcloud scheduler jobs create http room-bot-daily-pgma \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 19 * * 1-5" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"daily","workspaceId":"pgma"}' \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http room-bot-daily-pgma \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 19 * * 1-5" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"daily","workspaceId":"pgma"}' \
  --attempt-deadline=120s

gcloud scheduler jobs create http room-bot-daily-pka \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="5 19 * * 1-5" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"daily","workspaceId":"pka"}' \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http room-bot-daily-pka \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="5 19 * * 1-5" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"daily","workspaceId":"pka"}' \
  --attempt-deadline=120s

# Weekly summary — Sunday at 10 AM Chile time
echo "Creating weekly summary (Sunday 10:00 CLT)..."

gcloud scheduler jobs create http room-bot-weekly-pgma \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 10 * * 0" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"weekly","workspaceId":"pgma"}' \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http room-bot-weekly-pgma \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="0 10 * * 0" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"weekly","workspaceId":"pgma"}' \
  --attempt-deadline=120s

gcloud scheduler jobs create http room-bot-weekly-pka \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="5 10 * * 0" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"weekly","workspaceId":"pka"}' \
  --attempt-deadline=120s \
  2>/dev/null || \
gcloud scheduler jobs update http room-bot-weekly-pka \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --schedule="5 10 * * 0" \
  --time-zone="America/Santiago" \
  --uri="${SERVICE_URL}/remind/generate" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"type":"weekly","workspaceId":"pka"}' \
  --attempt-deadline=120s

echo ""
echo "=== Scheduler jobs created ==="
echo ""
echo "Jobs:"
echo "  room-bot-daily-pgma  — Mon-Fri 19:00 CLT"
echo "  room-bot-daily-pka   — Mon-Fri 19:05 CLT"
echo "  room-bot-weekly-pgma — Sunday 10:00 CLT"
echo "  room-bot-weekly-pka  — Sunday 10:05 CLT"
echo ""
echo "PKA runs 5 min after PGmA to avoid concurrent WhatsApp connections."
echo ""
echo "Test manually:"
echo "  gcloud scheduler jobs run room-bot-daily-pgma --project=${PROJECT_ID} --location=${REGION}"
