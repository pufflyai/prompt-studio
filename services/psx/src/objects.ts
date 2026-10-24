import { CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface PackageObjectConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}
export const createPackageObjects = async (config: PackageObjectConfig, createBucket = false) => {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  if (createBucket) await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  return {
    put: async (key: string, bytes: Uint8Array) => {
      // Release keys include the server-computed content hash. Concurrent writes
      // to one key therefore contain identical bytes; PostgreSQL owns version immutability.
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentType: "application/gzip",
        }),
      );
    },
    get: async (key: string) => {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!result.Body) throw new Error("PSX package object is missing");
      return result.Body.transformToByteArray();
    },
    close: () => client.destroy(),
  };
};
