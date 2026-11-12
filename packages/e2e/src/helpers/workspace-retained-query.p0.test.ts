import { expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { changed, createChangesQueries } from "pstdio-workspaces/testing";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
test("Workspaces retains its summary independently of lazy file bodies and drains abandoned optional content", async () => {
  const reads = { summary: 0, body: 0 };
  const entered = Promise.withResolvers<void>(),
    cancelled = Promise.withResolvers<void>();
  let hold = false,
    live = 0,
    maxLive = 0;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-workspaces",
    execute: async (command, signal) => {
      if (command.commandId.endsWith(".read-changes")) {
        reads.summary++;
        return { files: [{ filePath: "a.ts", newPath: "a.ts", change: "modified", additions: 1, deletions: 1 }] };
      }
      reads.body++;
      live++;
      maxLive = Math.max(maxLive, live);
      try {
        if (hold) {
          entered.resolve();
          await new Promise<void>((resolve) =>
            signal.addEventListener(
              "abort",
              () => {
                cancelled.resolve();
                resolve();
              },
              { once: true },
            ),
          );
          signal.throwIfAborted();
        }
        return { filePath: "a.ts", newPath: "a.ts", change: "modified", oldContent: "before", newContent: "after" };
      } finally {
        live--;
      }
    },
  });
  const frame = transport.frame(),
    client = createWebviewClient(frame.host),
    queries = createChangesQueries(client as never, "workspace", "current");
  let stop = queries.summary.subscribe(() => {});
  try {
    await queries.summary.read();
    queries.body("a.ts");
    expect(reads).toEqual({ summary: 1, body: 0 });
    stop();
    stop = queries.summary.subscribe(() => {});
    await turn();
    expect(reads).toEqual({ summary: 1, body: 0 });
    hold = true;
    const abort = new AbortController();
    const reading = queries
      .body("a.ts")
      .read(abort.signal)
      .catch((error) => error);
    await entered.promise;
    abort.abort();
    await cancelled.promise;
    await reading;
    expect(live).toBe(0);
    hold = false;
    await queries.body("a.ts").read();
    expect(reads).toEqual({ summary: 1, body: 2 });
    transport.emit("pstdio.pstdio-workspaces.event." + changed.id, "selected", ["different-workspace"]);
    await turn();
    expect(reads.summary).toBe(1);
    stop();
    transport.emit("pstdio.pstdio-workspaces.event." + changed.id, "selected", ["workspace"]);
    await turn();
    expect(reads).toEqual({ summary: 1, body: 2 });
    stop = queries.summary.subscribe(() => {});
    await queries.summary.read();
    expect(reads).toEqual({ summary: 2, body: 2 });
    const body = queries.body("a.ts");
    expect(body.getSnapshot().data?.newContent).toBe("after");
    await body.read();
    expect(reads.body).toBe(3);
    expect(maxLive).toBe(1);
  } finally {
    stop();
    client.queries.dispose();
    transport.dispose();
  }
});
