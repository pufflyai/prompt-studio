import { resolve } from "node:path";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { migrateRelayStorage } from "../storage/database";
import { createRelayAssets } from "./assets";

export const createAssetFixture = () => {
  const databaseUrl = process.env.SYNC_TEST_DATABASE_URL!;
  const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT!;
  if (!databaseUrl || !endpoint) throw new Error("Run through the isolated conformance runner");
  const bucket = `relay-assets-${crypto.randomUUID()}`;
  const s3 = {
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "conformance-access", secretAccessKey: "conformance-secret-only" },
  };
  const config = { databaseUrl, bucket, s3 };
  const client = new S3Client({ ...s3, maxAttempts: 1 });
  return {
    config,
    client,
    async initialize() {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../drizzle"));
    },
    close: () => client.destroy(),
    owner: () => createRelayAssets(config),
    proxy(intercept: (request: Request, response: Response) => Promise<Response>) {
      const proxy = Bun.serve({
        port: 0,
        async fetch(request) {
          const url = new URL(request.url);
          const response = await fetch(`${endpoint}${url.pathname}${url.search}`, {
            method: request.method,
            headers: request.headers,
            body: request.body,
          });
          return intercept(request, response);
        },
      });
      return {
        endpoint: proxy.url.href,
        owner: createRelayAssets({ ...config, s3: { ...s3, endpoint: proxy.url.href } }),
        close: () => proxy.stop(true),
      };
    },
  };
};

export const reference = (bytes: Uint8Array) => ({
  sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  byteLength: bytes.length,
  mediaType: "image/png",
});
export const input = (bytes: Uint8Array) => ({
  ...reference(bytes),
  body: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }),
});
export const newScope = () => ({ accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "images" });
