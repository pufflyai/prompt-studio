import { expect, test } from "bun:test";
import { createRequest } from "@pstdio/sdk/client";
import { QueryObserver } from "@tanstack/react-query";
import { getDashboardQueryClient } from "./query-client";
import { createRuntimeCollections } from "./sync/collections";

for (const loaded of [false, true]) {
  test(`page queries recover silently after repeated dropped responses with ${loaded ? "loaded content" : "no snapshot"}`, async () => {
    let attempts = 0;
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        attempts++;
        if (attempts <= 5) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"value":'));
                setTimeout(() => controller.error(new Error("Response dropped")), 10);
              },
            }),
          );
        }
        return Response.json({ value: "recovered" });
      },
    });
    const owner = createRuntimeCollections();
    const client = getDashboardQueryClient(owner);
    const request = createRequest({ baseUrl: server.url.origin });
    const key = ["connection-recovery", loaded];
    const snapshot = { value: "loaded" };
    if (loaded) client.setQueryData(key, snapshot);
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: () => request<{ value: string }>("/page"),
      retryDelay: 0,
    });
    const completed = Promise.withResolvers<void>();
    const results: { status: string; error: unknown; data: unknown }[] = [];
    const stop = observer.subscribe((result) => {
      results.push({ status: result.status, error: result.error, data: result.data });
      if (result.isError || result.data?.value === "recovered") completed.resolve();
    });
    try {
      await completed.promise;
      expect(attempts).toBe(6);
      expect(results.every((result) => result.error === null)).toBe(true);
      expect(results.at(-1)?.data).toEqual({ value: "recovered" });
      if (loaded) expect(results.slice(0, -1).every((result) => result.data === snapshot)).toBe(true);
      else expect(results.slice(0, -1).every((result) => result.status === "pending")).toBe(true);
    } finally {
      stop();
      await owner.dispose();
      await server.stop(true);
    }
  });
}

test("file query results and cleanup belong to their runtime connection", async () => {
  const first = createRuntimeCollections();
  const second = createRuntimeCollections();
  const a = getDashboardQueryClient(first);
  const b = getDashboardQueryClient(second);
  const key = ["api-file-url", "/v1/files/same/content"];
  const firstBlob = URL.createObjectURL(new Blob(["first"]));
  const secondBlob = URL.createObjectURL(new Blob(["second"]));
  a.setQueryData(key, firstBlob);
  expect(b.getQueryData(key)).toBeUndefined();
  b.setQueryData(key, secondBlob);
  await first.dispose();
  expect(a.getQueryData(key)).toBeUndefined();
  expect(b.getQueryData<string>(key)).toBe(secondBlob);
  expect(await (await fetch(secondBlob)).text()).toBe("second");
  let revoked = false;
  try {
    await fetch(firstBlob);
  } catch {
    revoked = true;
  }
  expect(revoked).toBe(true);
  await second.dispose();
});
