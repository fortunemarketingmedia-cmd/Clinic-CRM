#!/bin/sh
set -eu

attempt=0
until mc alias set internal "http://minio:9000" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "MinIO did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done

mc mb --ignore-existing "internal/$S3_BUCKET"
mc anonymous set none "internal/$S3_BUCKET"
mc version enable "internal/$S3_BUCKET"

cat > /tmp/revive-app-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:GetBucketVersioning", "s3:ListBucket", "s3:ListBucketMultipartUploads"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:AbortMultipartUpload", "s3:GetObject", "s3:ListMultipartUploadParts", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/$S3_KEY_PREFIX", "arn:aws:s3:::$S3_BUCKET/$S3_KEY_PREFIX/*"]
    }
  ]
}
EOF

mc admin user add internal "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null 2>&1 || mc admin user enable internal "$S3_ACCESS_KEY_ID" >/dev/null
mc admin policy create internal revive-crm-app /tmp/revive-app-policy.json >/dev/null
mc admin policy attach internal revive-crm-app --user "$S3_ACCESS_KEY_ID" >/dev/null
echo "Private versioned MinIO bucket and least-privilege application identity are ready: $S3_BUCKET"
