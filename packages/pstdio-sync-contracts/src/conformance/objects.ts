import { CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { canonicalJson } from "../fingerprint";
import type { Asset, Scope } from "../wire";

// Disposable test object storage. Buffered fixtures are intentionally small.
export function createObjects(endpoint: string) {
  const s3 = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "conformance-access", secretAccessKey: "conformance-secret-only" },
    maxAttempts: 1,
  });
  const bucket = "sync-conformance";
  const key = (scope: Scope, hash: string) => `${encodeURIComponent(canonicalJson(scope))}/${hash}`;
  return {
    async initialize() {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    },
    async put(scope: Scope, asset: Asset, bytes: Uint8Array) {
      const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
      if (hash !== asset.sha256 || bytes.length !== asset.byteLength) throw new Error("incomplete asset");
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key(scope, asset.sha256), Body: bytes }));
    },
    async get(scope: Scope, asset: Asset) {
      try {
        const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key(scope, asset.sha256) }));
        const bytes = await result.Body!.transformToByteArray();
        if (
          new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== asset.sha256 ||
          bytes.length !== asset.byteLength
        )
          return null;
        return bytes;
      } catch (error) {
        if (error instanceof Error && error.name === "NoSuchKey") return null;
        throw error;
      }
    },
    close() {
      s3.destroy();
    },
  };
}
export type TestObjects = ReturnType<typeof createObjects>;
