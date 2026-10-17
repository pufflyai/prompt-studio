import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createAssetFixture } from "./integration-fixture";
import { checkObjectStorage } from "./objects.contract";

const fixture = createAssetFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const ownedPrefix = { Bucket: fixture.config.bucket, Prefix: "relay-storage-contract/" };
const cleanFaults = async () => {
  const uploads = await fixture.client.send(new ListMultipartUploadsCommand(ownedPrefix));
  for (const upload of uploads.Uploads ?? [])
    await fixture.client.send(
      new AbortMultipartUploadCommand({ Bucket: fixture.config.bucket, Key: upload.Key, UploadId: upload.UploadId }),
    );
  const objects = await fixture.client.send(new ListObjectsV2Command(ownedPrefix));
  for (const object of objects.Contents ?? [])
    await fixture.client.send(new DeleteObjectCommand({ Bucket: fixture.config.bucket, Key: object.Key }));
};

test("the provider probe removes multipart state when its create response is lost", async () => {
  let lost = false;
  const proxy = fixture.proxy(async (request, response) => {
    if (request.method === "POST" && new URL(request.url).searchParams.has("uploads") && !lost) {
      lost = true;
      await response.arrayBuffer();
      return new Response("Lost create response", { status: 502 });
    }
    return response;
  });
  try {
    await expect(
      checkObjectStorage({ ...fixture.config, s3: { ...fixture.config.s3, endpoint: proxy.endpoint } }),
    ).rejects.toThrow();
    expect(lost).toBe(true);
    expect((await fixture.client.send(new ListMultipartUploadsCommand(ownedPrefix))).Uploads ?? []).toHaveLength(0);
    expect((await fixture.client.send(new ListObjectsV2Command(ownedPrefix))).Contents ?? []).toHaveLength(0);
  } finally {
    await cleanFaults();
    await proxy.owner.close();
    await proxy.close();
  }
});

test("a probe cleanup failure does not skip its other owned keys", async () => {
  const deleted = new Set<string>();
  const proxy = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "DELETE" && url.searchParams.has("uploadId"))
        return new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
      if (request.method === "DELETE") deleted.add(url.pathname);
      return fetch(`${fixture.config.s3.endpoint}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    },
  });
  try {
    await expect(
      checkObjectStorage({ ...fixture.config, s3: { ...fixture.config.s3, endpoint: proxy.url.href } }),
    ).rejects.toThrow();
    expect(deleted.size).toBe(3);
    expect((await fixture.client.send(new ListObjectsV2Command(ownedPrefix))).Contents ?? []).toHaveLength(0);
  } finally {
    await cleanFaults();
    await proxy.stop(true);
  }
});
