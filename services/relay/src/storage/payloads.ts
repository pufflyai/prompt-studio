import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { createAssetObjects, type ObjectConfig } from "../assets/objects";

const missing = (error: unknown) =>
  error instanceof S3ServiceException && (error.$metadata.httpStatusCode ?? 0) === 404;

const hash = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

export const documentObjectPrefix = (projectKey: string, documentId: string) =>
  `documents/${hash(`${projectKey}\n${documentId}`)}/`;

/** Encrypted update and latest-state bytes. Keys contain only hashes and random names. */
export const createPayloadObjects = (config: ObjectConfig) => {
  const client = new S3Client({ ...config.s3, maxAttempts: 1 });
  const uploads = createAssetObjects(config);
  const shutdown = new AbortController();
  const target = (key: string) => ({ Bucket: config.bucket, Key: key });
  return {
    multipartPages: uploads.multipartPages,
    reserve: (key: string) => uploads.initiate(key, "application/octet-stream", shutdown.signal),
    async put(key: string, uploadId: string, bytes: Uint8Array, request?: AbortSignal) {
      // A multipart upload is a revocable write capability. If its completion reply
      // is lost, cleanup fences that upload before verifying the key is absent.
      const signal = request ? AbortSignal.any([request, shutdown.signal]) : shutdown.signal;
      const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
      const asset = { sha256, byteLength: bytes.byteLength, mediaType: "application/octet-stream" };
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      const etag = await uploads.write(key, uploadId, 1, { ...asset, body }, signal);
      await uploads.finish(key, uploadId, [{ number: 1, etag, sha256 }], signal);
    },
    discard: (key: string, multipartId: string | null, signal?: AbortSignal) =>
      uploads.discard(key, multipartId, signal),
    /** Returns null when cleanup removed the object after its row was read. */
    async open(key: string, signal?: AbortSignal) {
      try {
        const result = await client.send(new GetObjectCommand(target(key)), { abortSignal: signal });
        if (!result.Body) throw new Error("Object storage returned no body");
        return result.Body;
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async remove(key: string, signal?: AbortSignal) {
      await client.send(new DeleteObjectCommand(target(key)), { abortSignal: signal });
    },
    async *keys(prefix: string, signal?: AbortSignal) {
      let continuation: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: continuation }),
          { abortSignal: signal },
        );
        yield (page.Contents ?? []).flatMap(({ Key }) => (Key ? [Key] : []));
        continuation = page.NextContinuationToken;
      } while (continuation);
    },
    async verifyRemoved(key: string, signal?: AbortSignal) {
      try {
        await client.send(new HeadObjectCommand(target(key)), { abortSignal: signal });
      } catch (error) {
        if (missing(error)) return;
        throw error;
      }
      throw new Error("Object storage retained a deleted payload");
    },
    close() {
      shutdown.abort();
      uploads.close();
      client.destroy();
    },
  };
};
export type PayloadObjects = ReturnType<typeof createPayloadObjects>;
