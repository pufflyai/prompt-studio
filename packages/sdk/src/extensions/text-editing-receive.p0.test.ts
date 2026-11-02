import { expect, test } from "bun:test";
import { textEditingSessionFixture } from "./text-editing-session.test-fixture";

test("queued renderer edits flush before remote text embedded in a durable acknowledgement is applied", async () => {
  const f = await textEditingSessionFixture();
  let pendingRenderer = true;
  let firstReply = true;
  f.beforeAck(() => {
    if (!firstReply) return;
    firstReply = false;
    f.document.getText("content").insert(0, "peer ");
  });
  const stop = f.session.beforeReceive(() => {
    if (!pendingRenderer) return;
    pendingRenderer = false;
    expect(f.session.getSnapshot().text.toString()).toBe("local source");
    f.session.transact((text) => text.insert(text.length, " deferred"));
  });
  try {
    f.session.transact((text) => text.insert(0, "local "));
    await f.session.flush();
    await f.session.flush();
    expect(f.document.getText("content").toString()).toBe("peer local source deferred");
    expect(f.session.getSnapshot().pending).toBe(false);
    expect(f.frames).toHaveLength(2);
  } finally {
    stop();
    await f.session.close();
    f.document.destroy();
  }
});

test("a refused incoming snapshot can be delivered at the same event version after its renderer hook is removed", async () => {
  const f = await textEditingSessionFixture();
  const stop = f.session.beforeReceive(() => {
    throw new Error("Pending renderer could not flush");
  });
  try {
    f.document.getText("content").insert(0, "peer ");
    const event = { type: "snapshot", version: 1, snapshot: await f.snapshot() };
    expect(() => f.emit(event)).toThrow("Pending renderer could not flush");
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    stop();
    f.emit(event);
    expect(f.session.getSnapshot().text.toString()).toBe("peer source");
  } finally {
    stop();
    await f.session.close();
    f.document.destroy();
  }
});

test("a renderer failure before applying a durable receipt retains its authored fence for idempotent retry", async () => {
  const f = await textEditingSessionFixture();
  const stop = f.session.beforeReceive(() => {
    throw new Error("Renderer flush interrupted");
  });
  try {
    f.session.transact((text) => text.insert(0, "local "));
    await expect(f.session.flush()).rejects.toThrow("Renderer flush interrupted");
    expect(f.session.getSnapshot().pending).toBe(true);
    expect(f.document.getText("content").toString()).toBe("local source");
    stop();
    await f.session.retry();
    expect(f.session.getSnapshot().pending).toBe(false);
    expect(f.document.getText("content").toString()).toBe("local source");
    expect(f.sequences).toEqual([1, 1]);
  } finally {
    stop();
    await f.session.close();
    f.document.destroy();
  }
});

test("recursive incoming delivery cannot mutate text while its renderer flush is in progress", async () => {
  const f = await textEditingSessionFixture();
  f.document.getText("content").insert(0, "peer ");
  const event = { type: "snapshot", version: 1, snapshot: await f.snapshot() };
  const stop = f.session.beforeReceive(() => f.emit({ ...event, version: 2 }));
  try {
    expect(() => f.emit(event)).toThrow();
    expect(f.session.getSnapshot().text.toString()).toBe("source");
    stop();
    f.emit(event);
    expect(f.session.getSnapshot().text.toString()).toBe("peer source");
  } finally {
    stop();
    await f.session.close();
    f.document.destroy();
  }
});

test("rejecting an asynchronous receive handler also owns its rejected promise", async () => {
  const module = new URL("./text-editing-replica.ts", import.meta.url).href;
  const child = Bun.spawn(
    [
      process.execPath,
      "--eval",
      `const {createTextReceiveHandlers}=await import(${JSON.stringify(module)});
       const handlers=createTextReceiveHandlers();
       handlers.add(async()=>{throw new Error("Rejected async renderer");});
       let refused=false;
       try { handlers.run(); } catch (error) { refused=error.code==="source_unavailable"; }
       if (!refused) throw new Error("Async receive handler was not refused");
       await new Promise(resolve=>setImmediate(resolve));`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const stderr = await new Response(child.stderr).text();
  expect({ exitCode: await child.exited, stderr }).toEqual({ exitCode: 0, stderr: "" });
});
