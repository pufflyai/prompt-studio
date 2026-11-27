import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListMultipartUploadsCommand,
  NoSuchUpload,
  S3Client,
  type S3ClientConfig,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { managedPackageMaxBytes } from "pstdio-sync-contracts";

export interface ManagedPackageObjects {
  reserve(id: string): Promise<string>;
  write(id: string, uploadId: string, bytes: Uint8Array): Promise<void>;
  read(id: string): Promise<Uint8Array>;
  remove(id: string): Promise<void>;
  close(): void;
}

export const createManagedPackageObjects = (bucket: string, config: S3ClientConfig) => {
  const client = new S3Client({ ...config, maxAttempts: 1 });
  const target = (id: string) => ({ Bucket: bucket, Key: `managed-packages/${id}` });
  const options = () => ({ abortSignal: AbortSignal.timeout(30_000) });
  const abortUpload = async (id: string, uploadId: string) => {
    try {
      await client.send(new AbortMultipartUploadCommand({ ...target(id), UploadId: uploadId }), options());
    } catch (error) {
      // Completion or another cleanup can win after the listing was read.
      if (!(error instanceof NoSuchUpload)) throw error;
    }
  };
  return {
    async reserve(id: string) {
      const result = await client.send(
        new CreateMultipartUploadCommand({ ...target(id), ContentType: "application/octet-stream" }),
        options(),
      );
      if (!result.UploadId) throw new Error("Package upload unavailable");
      return result.UploadId;
    },
    async write(id: string, uploadId: string, bytes: Uint8Array) {
      const part = await client.send(
        new UploadPartCommand({ ...target(id), UploadId: uploadId, PartNumber: 1, Body: bytes }),
        options(),
      );
      if (!part.ETag) throw new Error("Package upload receipt unavailable");
      await client.send(
        new CompleteMultipartUploadCommand({
          ...target(id),
          UploadId: uploadId,
          MultipartUpload: { Parts: [{ PartNumber: 1, ETag: part.ETag }] },
        }),
        options(),
      );
    },
    async read(id: string) {
      const object = await client.send(new GetObjectCommand(target(id)), options());
      if (!object.Body || !object.ContentLength || object.ContentLength > managedPackageMaxBytes)
        throw new Error("Package bytes unavailable");
      return object.Body.transformToByteArray();
    },
    async remove(id: string) {
      const { Key } = target(id);
      let KeyMarker: string | undefined;
      let UploadIdMarker: string | undefined;
      do {
        const uploads = await client.send(
          new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: Key, KeyMarker, UploadIdMarker }),
          options(),
        );
        for (const upload of uploads.Uploads ?? []) {
          if (upload.Key !== Key || !upload.UploadId) continue;
          await abortUpload(id, upload.UploadId);
        }
        KeyMarker = uploads.IsTruncated ? uploads.NextKeyMarker : undefined;
        UploadIdMarker = uploads.NextUploadIdMarker;
      } while (KeyMarker);
      // Revoke incomplete writes before deleting their bytes, including lost reserve replies.
      await client.send(new DeleteObjectCommand(target(id)), options());
    },
    close: () => client.destroy(),
  } satisfies ManagedPackageObjects;
};

export const managedPackageObjectsFromEnvironment = (env: NodeJS.ProcessEnv) => {
  const bucket = env.MANAGED_PACKAGE_S3_BUCKET;
  if (!bucket) return undefined;
  const accessKeyId = env.MANAGED_PACKAGE_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.MANAGED_PACKAGE_S3_SECRET_ACCESS_KEY;
  const region = env.MANAGED_PACKAGE_S3_REGION;
  if (!accessKeyId || !secretAccessKey || !region) throw new Error("Incomplete managed package storage configuration");
  return createManagedPackageObjects(bucket, {
    region,
    endpoint: env.MANAGED_PACKAGE_S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
};
