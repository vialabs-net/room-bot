#!/usr/bin/env bash
# One-time GCP setup for room-bot
# Run: bash infra/setup.sh

set -euo pipefail

PROJECT_ID="recole-485714"
REGION="us-central1"
SA_NAME="room-bot-sa"
BUCKET_NAME="${PROJECT_ID}-room-bot-wa-auth"

echo "=== room-bot GCP setup ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# 1. Enable APIs
echo "Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Create service account
echo "Creating service account..."
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="room-bot Cloud Run SA" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "Service account already exists"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# 3. Grant roles
echo "Granting IAM roles..."
for ROLE in \
  roles/datastore.user \
  roles/storage.objectAdmin \
  roles/secretmanager.secretAccessor \
  roles/run.invoker; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}" \
    --quiet
done

# 4. Create GCS bucket for WhatsApp auth
echo "Creating GCS bucket..."
gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --uniform-bucket-level-access 2>/dev/null || echo "Bucket already exists"

# 5. Create Anthropic API key secret
echo ""
echo "=== Manual step ==="
echo "Store your Anthropic API key in Secret Manager:"
echo ""
echo "  echo -n 'sk-ant-...' | gcloud secrets create anthropic-api-key \\"
echo "    --data-file=- --project=${PROJECT_ID}"
echo ""
echo "Or if the secret already exists:"
echo ""
echo "  echo -n 'sk-ant-...' | gcloud secrets versions add anthropic-api-key \\"
echo "    --data-file=- --project=${PROJECT_ID}"
echo ""

echo "=== Setup complete ==="
echo "Service account: ${SA_EMAIL}"
echo "GCS bucket: gs://${BUCKET_NAME}"
echo ""
echo "Next: run 'bash infra/deploy.sh' to deploy"
