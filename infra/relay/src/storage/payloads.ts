import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { ObjectConfig } from "../assets/objects";

const missing = (error: unknown) =>
  error instanceof S3ServiceException && (error.$metadata.httpStatusCode ?? 0) === 404;

const hash = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

/** Encrypted update and latest-state bytes. Keys contain only hashes and random names. */
export const createPayloadObjects = (config: ObjectConfig) => {
  const client = new S3Client({ ...config.s3, maxAttempts: 1 });
  const target = (key: string) => ({ Bucket: config.bucket, Key: key });
  return {
    // Each write gets its own key, so a retry or a lost race never overwrites stored bytes.
    key: (projectId: string, documentId: string, kind: "updates" | "states") =>
      `documents/${hash(`${projectId}\n${documentId}`)}/${kind}/${crypto.randomUUID()}`,
    async put(key: string, bytes: Uint8Array, signal?: AbortSignal) {
      await client.send(
        new PutObjectCommand({
          ...target(key),
          Body: bytes,
          ContentLength: bytes.byteLength,
          ContentType: "application/octet-stream",
        }),
        { abortSignal: signal },
      );
    },
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
    close: () => client.destroy(),
  };
};
export type PayloadObjects = ReturnType<typeof createPayloadObjects>;
