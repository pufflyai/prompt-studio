import { expect, test } from "bun:test";
import { createClient } from "./client";

test("workspace read cancellation covers response body consumption", async () => {
  const opened = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("{"));
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  });
  const controller = new AbortController();
  const client = createClient({
    baseUrl: server.url.toString(),
    fetch: (async (...args: Parameters<typeof fetch>) => {
      const response = await fetch(...args);
      const readJson = response.json.bind(response);
      response.json = () => {
        const reading = readJson();
        opened.resolve();
        return reading;
      };
      return response;
    }) as typeof fetch,
  });
  const reading = client.workspaces.readFile("workspace", "large.txt", { signal: controller.signal }).then(
    () => "completed",
    (error) => error.name,
  );
  try {
    await opened.promise;
    controller.abort();
    expect(await Promise.race([reading, Bun.sleep(100).then(() => "still reading")])).toBe("AbortError");
  } finally {
    await server.stop(true);
    await reading;
  }
});
