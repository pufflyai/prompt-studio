import {
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { Asset } from "pstdio-sync-contracts";
import { createAssetObjects, type ObjectConfig } from "../assets/objects";
import { checkedBytes, checkedStream, multipartSize } from "../assets/streams";
import { backupParts, byteStream, copyKey, jsonAsset } from "./object-streams";

export { copyKey } from "./object-streams";

export const createBackupObjects = (config: ObjectConfig) => {
  const objects = createAssetObjects(config);
  const client = new S3Client({ ...config.s3, maxAttempts: 1 });
  const put = async (
    key: string,
    asset: Asset,
    open: () => Promise<ReadableStream<Uint8Array>>,
    signal: AbortSignal,
  ) => {
    if (await objects.head(key, undefined, signal)) {
      await objects.verify(key, asset, signal);
      return;
    }
    if (!asset.byteLength) {
      const source = await open();
      for await (const _chunk of checkedBytes(source, asset, signal)) {
      }
      await objects.empty(key, asset, signal);
    } else {
      multipartSize(asset.byteLength);
      const id = await objects.begin(key, asset, signal);
      try {
        const source = await open();
        const parts: { number: number; sha256: string; etag: string }[] = [];
        for await (const bytes of backupParts(source, asset, signal)) {
          const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
          const number = parts.length + 1;
          const etag = await objects.write(
            key,
            id,
            number,
            {
              sha256,
              byteLength: bytes.byteLength,
              body: byteStream(bytes),
            },
            signal,
          );
          parts.push({ number, sha256, etag });
        }
        await objects.finish(key, id, parts, signal);
      } catch (error) {
        await objects.discard(key, id, signal).catch(() => {});
        throw error;
      }
    }
    await objects.verify(key, asset, signal);
  };
  const read = async (key: string, asset: Asset, signal?: AbortSignal) => {
    const metadata = await objects.head(key, undefined, signal);
    if (!metadata?.ETag || metadata.ContentLength !== asset.byteLength || metadata.ContentType !== asset.mediaType)
      throw new Error("Backup object metadata mismatch");
    return checkedStream(await objects.get(key, metadata.ETag, signal), asset, signal);
  };
  const abortUpload = async (upload: { Key?: string; UploadId?: string }, signal: AbortSignal) => {
    if (
      !upload.Key ||
      !upload.UploadId ||
      !["objects/", "manifests/", "complete/"].some((prefix) => upload.Key!.startsWith(prefix))
    )
      return;
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: config.bucket,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }),
        { abortSignal: signal },
      );
    } catch (error) {
      if (!(error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)) throw error;
    }
  };
  return {
    put,
    read,
    verify: objects.verify,
    async discardIncomplete(signal: AbortSignal) {
      let keyMarker: string | undefined;
      let uploadMarker: string | undefined;
      do {
        const page = await client.send(
          new ListMultipartUploadsCommand({
            Bucket: config.bucket,
            KeyMarker: keyMarker,
            UploadIdMarker: uploadMarker,
          }),
          { abortSignal: signal },
        );
        for (const upload of page.Uploads ?? []) await abortUpload(upload, signal);
        keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
        uploadMarker = page.NextUploadIdMarker;
      } while (keyMarker);
    },
    async copy(asset: Asset, open: () => Promise<ReadableStream<Uint8Array>>, signal: AbortSignal) {
      await put(await copyKey(asset), asset, open, signal);
    },
    async json<T>(key: string, asset: Asset, parse: (value: unknown) => T, signal?: AbortSignal) {
      return parse(await new Response(await read(key, asset, signal)).json());
    },
    async putJson(prefix: string, value: unknown, signal: AbortSignal) {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const asset = jsonAsset(bytes);
      const key = prefix + asset.sha256;
      await put(key, asset, async () => byteStream(bytes), signal);
      return { key, asset };
    },
    async status(signal?: AbortSignal) {
      const metadata = await objects.head("status.json", undefined, signal);
      if (!metadata?.ETag) return null;
      const body = await objects.get("status.json", metadata.ETag, signal);
      return { etag: metadata.ETag, value: (await new Response(body).json()) as unknown };
    },
    async writeStatus(value: unknown, etag: string | undefined, signal: AbortSignal) {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const result = await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: "status.json",
          Body: bytes,
          ContentType: "application/json",
          ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
        }),
        { abortSignal: signal },
      );
      if (!result.ETag) throw new Error("Backup status receipt is missing");
      await objects.verify("status.json", jsonAsset(bytes), signal);
      return result.ETag;
    },
    async *completions() {
      let token: string | undefined;
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: "complete/",
            ContinuationToken: token,
          }),
        );
        for (const object of result.Contents ?? []) {
          const sha256 = object.Key?.split("/").at(-1);
          if (object.Key && sha256?.match(/^[a-f0-9]{64}$/) && object.Size !== undefined)
            yield { key: object.Key, asset: { sha256, byteLength: object.Size, mediaType: "application/json" } };
        }
        token = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (token);
    },
    close() {
      objects.close();
      client.destroy();
    },
  };
};
