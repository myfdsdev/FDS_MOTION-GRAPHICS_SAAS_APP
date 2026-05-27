import fs from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// S3-compatible object storage (Cloudflare R2). Configured entirely via env.
const {
  S3_ENDPOINT,
  S3_REGION = "auto",
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_PUBLIC_URL,
} = process.env;

export function isStorageConfigured() {
  return Boolean(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY && S3_PUBLIC_URL);
}

let client = null;
function getClient() {
  if (!client) {
    client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
      forcePathStyle: true, // R2 works with path-style addressing
    });
  }
  return client;
}

// Uploads a local file and returns its public URL. Reads into a Buffer so the
// S3 client always has a known ContentLength (avoids stream-length errors).
export async function uploadFile(localPath, key, contentType) {
  const Body = await fs.promises.readFile(localPath);
  await getClient().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body,
      ContentType: contentType,
    })
  );
  return `${S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}
