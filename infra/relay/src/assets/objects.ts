import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
  S3ServiceException,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import type { Asset } from "pstdio-sync-contracts";
import { checkedBytes, type PartInput } from "./streams";

export interface ObjectConfig {
  bucket: string;
  s3: S3ClientConfig;
}

const missing = (error: unknown) =>
  error instanceof S3ServiceException && [404, 412].includes(error.$metadata.httpStatusCode ?? 0);

export const createAssetObjects = (config: ObjectConfig) => {
  const client = new S3Client({ ...config.s3, maxAttempts: 1 });
  const target = (key: string) => ({ Bucket: config.bucket, Key: key });
  const head = async (key: string, etag?: string, signal?: AbortSignal) => {
    try {
      return await client.send(new HeadObjectCommand({ ...target(key), IfMatch: etag }), { abortSignal: signal });
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  };
  const get = async (key: string, etag: string, signal?: AbortSignal) => {
    const result = await client.send(new GetObjectCommand({ ...target(key), IfMatch: etag }), { abortSignal: signal });
    if (!result.Body) throw new Error("Object storage returned no body");
    return result.Body.transformToWebStream();
  };
  const abort = async (key: string, uploadId: string, signal?: AbortSignal) => {
    try {
      await client.send(new AbortMultipartUploadCommand({ ...target(key), UploadId: uploadId }), {
        abortSignal: signal,
      });
    } catch (error) {
      if (!missing(error)) throw error;
    }
  };
  const uploads = async (key: string, signal?: AbortSignal) => {
    let KeyMarker: string | undefined;
    let UploadIdMarker: string | undefined;
    const ids: string[] = [];
    do {
      const result = await client.send(
        new ListMultipartUploadsCommand({ Bucket: config.bucket, Prefix: key, KeyMarker, UploadIdMarker }),
        { abortSignal: signal },
      );
      for (const upload of result.Uploads ?? []) if (upload.Key === key && upload.UploadId) ids.push(upload.UploadId);
      KeyMarker = result.IsTruncated ? result.NextKeyMarker : undefined;
      UploadIdMarker = result.NextUploadIdMarker;
    } while (KeyMarker);
    return ids;
  };
  return {
    head,
    get,
    async range(key: string, etag: string, asset: Asset, offset: number, signal?: AbortSignal) {
      const result = await client.send(
        new GetObjectCommand({ ...target(key), IfMatch: etag, Range: `bytes=${offset}-` }),
        { abortSignal: signal },
      );
      if (!result.Body) throw new Error("Object storage returned no range body");
      const body = result.Body.transformToWebStream();
      if (
        result.$metadata.httpStatusCode !== 206 ||
        result.ETag !== etag ||
        result.ContentRange !== `bytes ${offset}-${asset.byteLength - 1}/${asset.byteLength}` ||
        result.ContentLength !== asset.byteLength - offset ||
        result.ContentType !== asset.mediaType
      ) {
        await body.cancel();
        throw new Error("Object storage returned an invalid immutable range");
      }
      return body;
    },
    async begin(key: string, asset: Asset, signal?: AbortSignal) {
      // A lost Create response can leave an empty multipart upload before its ID is saved.
      const [recovered, ...duplicates] = await uploads(key, signal);
      for (const duplicate of duplicates) await abort(key, duplicate, signal);
      if (recovered) return recovered;
      const result = await client.send(
        new CreateMultipartUploadCommand({ ...target(key), ContentType: asset.mediaType, ChecksumAlgorithm: "SHA256" }),
        { abortSignal: signal },
      );
      if (!result.UploadId) throw new Error("Object storage returned no upload identity");
      return result.UploadId;
    },
    async write(key: string, uploadId: string, number: number, input: PartInput, signal: AbortSignal) {
      const controller = new AbortController();
      const combined = AbortSignal.any([controller.signal, signal, ...(input.signal ? [input.signal] : [])]);
      const body = Readable.from(checkedBytes(input.body, input, combined), {
        objectMode: false,
        highWaterMark: 64 * 1024,
      });
      body.on("error", (error) => controller.abort(error));
      const drained = finished(body);
      void drained.catch(() => {});
      try {
        const result = await client.send(
          new UploadPartCommand({
            ...target(key),
            UploadId: uploadId,
            PartNumber: number,
            ContentLength: input.byteLength,
            ChecksumSHA256: Buffer.from(input.sha256, "hex").toString("base64"),
            Body: body,
          }),
          { abortSignal: combined },
        );
        await drained;
        if (!result.ETag) throw new Error("Object storage returned no part receipt");
        return result.ETag;
      } finally {
        controller.abort();
        body.destroy();
        await drained.catch(() => {});
      }
    },
    async finish(
      key: string,
      uploadId: string,
      parts: { number: number; etag: string; sha256: string }[],
      signal?: AbortSignal,
    ) {
      await client.send(
        new CompleteMultipartUploadCommand({
          ...target(key),
          UploadId: uploadId,
          IfNoneMatch: "*",
          MultipartUpload: {
            Parts: parts.map((part) => ({
              PartNumber: part.number,
              ETag: part.etag,
              ChecksumSHA256: Buffer.from(part.sha256, "hex").toString("base64"),
            })),
          },
        }),
        { abortSignal: signal },
      );
    },
    async empty(key: string, asset: Asset, signal?: AbortSignal) {
      await client.send(
        new PutObjectCommand({
          ...target(key),
          Body: new Uint8Array(),
          ContentType: asset.mediaType,
          IfNoneMatch: "*",
        }),
        { abortSignal: signal },
      );
    },
    async verify(key: string, asset: Asset, signal?: AbortSignal) {
      const metadata = await head(key, undefined, signal);
      if (!metadata?.ETag || metadata.ContentLength !== asset.byteLength) throw new Error("Asset length mismatch");
      if (metadata.ContentType !== asset.mediaType) throw new Error("Asset media type mismatch");
      for await (const _chunk of checkedBytes(await get(key, metadata.ETag, signal), asset, signal)) {
        // Verification deliberately reads durable bytes, not the multipart composite checksum.
      }
      return metadata.ETag;
    },
    async discard(key: string, uploadId: string | null, signal?: AbortSignal) {
      // The writer lock has drained in-flight parts before this cleanup starts.
      const ids = new Set([...(uploadId ? [uploadId] : []), ...(await uploads(key, signal))]);
      for (const id of ids) {
        await abort(key, id, signal);
        try {
          await client.send(new ListPartsCommand({ ...target(key), UploadId: id }), { abortSignal: signal });
        } catch (error) {
          if (missing(error)) continue;
          throw error;
        }
        throw new Error("Object storage retained an aborted multipart upload");
      }
    },
    remove: (key: string, signal?: AbortSignal) =>
      client.send(new DeleteObjectCommand(target(key)), { abortSignal: signal }),
    close: () => client.destroy(),
  };
};
