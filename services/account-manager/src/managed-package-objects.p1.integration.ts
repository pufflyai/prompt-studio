import { expect, test } from "bun:test";
import { AbortMultipartUploadCommand, ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { createManagedPackageObjects } from "./managed-package-objects";
import { createManagedPackageObjectFixture } from "./managed-package-objects.fixture";

test("managed packages survive client restart and removal tolerates another cleaner winning an upload", async () => {
  const fixture = await createManagedPackageObjectFixture();
  const id = crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  let restarted: ReturnType<typeof createManagedPackageObjects> | undefined;
  let cleanup: ReturnType<typeof createManagedPackageObjects> | undefined;
  let proxy: ReturnType<typeof Bun.serve> | undefined;
  let interrupted = false;
  try {
    const upload = await fixture.objects.reserve(id);
    await fixture.objects.write(id, upload, bytes);
    restarted = createManagedPackageObjects(fixture.bucket, fixture.config);
    expect(await restarted.read(id)).toEqual(bytes);
    const pending = await fixture.objects.reserve(id);
    // Forward real S3 traffic, but let another cleaner win after the list response.
    // This produces the same NoSuchUpload race as completion/abort between list and abort.
    proxy = Bun.serve({
      hostname: "0.0.0.0",
      port: 0,
      fetch: async (request) => {
        const url = new URL(request.url);
        const target = new URL(fixture.config.endpoint);
        target.pathname = url.pathname;
        target.search = url.search;
        const headers = new Headers(request.headers);
        const response = await fetch(target, { method: request.method, headers, body: request.body });
        const result = new Response(await response.arrayBuffer(), response);
        if (url.searchParams.has("uploads") && request.method === "GET" && !interrupted) {
          interrupted = true;
          await fixture.client.send(
            new AbortMultipartUploadCommand({
              Bucket: fixture.bucket,
              Key: `managed-packages/${id}`,
              UploadId: pending,
            }),
          );
        }
        return result;
      },
    });
    cleanup = createManagedPackageObjects(fixture.bucket, {
      ...fixture.config,
      endpoint: `http://127.0.0.1:${proxy.port}`,
    });
    await cleanup.remove(id);
    expect(interrupted).toBe(true);
    expect(
      (await fixture.client.send(new ListMultipartUploadsCommand({ Bucket: fixture.bucket }))).Uploads ?? [],
    ).toEqual([]);
    const missing = await restarted.read(id).then(
      () => false,
      () => true,
    );
    expect(missing).toBe(true);
    await cleanup.remove(id);
  } finally {
    proxy?.stop(true);
    restarted?.close();
    cleanup?.close();
    await fixture.close();
  }
});
