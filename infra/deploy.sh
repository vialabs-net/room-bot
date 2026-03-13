#!/usr/bin/env bash
# Deploy room-bot to Cloud Run
# Run: bash infra/deploy.sh

set -euo pipefail

PROJECT_ID="recole-485714"
REGION="us-central1"
SERVICE_NAME="room-bot"
SA_EMAIL="room-bot-sa@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-room-bot-wa-auth"

echo "=== Deploying room-bot to Cloud Run ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --source=. \
  --service-account="${SA_EMAIL}" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},WA_AUTH_BUCKET=${BUCKET_NAME},WORKSPACE_ID=pgma,ADMIN_TOKEN=${ADMIN_TOKEN:?Set ADMIN_TOKEN env var before deploying}" \
  --set-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest,GMAIL_CLIENT_ID=gmail-client-id:latest,GMAIL_CLIENT_SECRET=gmail-client-secret:latest,GMAIL_REFRESH_TOKEN=gmail-refresh-token:latest" \
  --timeout=120 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --allow-unauthenticated \
  --quiet

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

echo ""
echo "=== Deployed ==="
echo "URL: ${SERVICE_URL}"
echo "Health: ${SERVICE_URL}/health"
echo ""
echo "Update SERVICE_URL env var so approval links work:"
echo ""
echo "  gcloud run services update ${SERVICE_NAME} \\"
echo "    --update-env-vars=SERVICE_URL=${SERVICE_URL} \\"
echo "    --project=${PROJECT_ID} --region=${REGION}"
echo ""
echo "Next: run 'bash infra/scheduler.sh' to create cron jobs"
