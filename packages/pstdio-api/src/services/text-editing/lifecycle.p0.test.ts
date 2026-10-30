import { afterEach, expect, test } from "bun:test";
import { createTextEditingClient, type GuestHost } from "@pstdio/sdk/extensions";
import type { TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { editorView, selected, textEditingFixture } from "./text-editing.test-fixture";

const fixtures: Awaited<ReturnType<typeof textEditingFixture>>[] = [];
afterEach(async () => {
  for (const f of fixtures.splice(0)) await f.cleanup();
});
const setup = async () => {
  const f = await textEditingFixture();
  fixtures.push(f);
  const address = {
    projectId: "project-1",
    token: (await f.text.connect("project-1", { kind: "placement", viewId: editorView, target: selected })).token,
  };
  let hold: ((input: TextEditingRequest) => Promise<void>) | undefined;
  const host = {
    call: async (_name: string, input: TextEditingRequest) => {
      const result = await f.text.request(address, input);
      await hold?.(input);
      return result;
    },
    onEvent: (_scope: string, listener: (payload: unknown) => void) => f.text.listen(address, listener),
  } as GuestHost;
  const client = createTextEditingClient(host);
  return {
    ...f,
    address,
    client,
    hold: (handler?: (input: TextEditingRequest) => Promise<void>) => {
      hold = handler;
    },
    open: async () => client.open({ grant: (await client.current())! }),
  };
};

test("one failed close finalizer restores every member of the same placement", async () => {
  const f = await setup();
  const first = await f.open();
  const second = await f.open();
  const draft = second.createDraft();
  draft.text.insert(0, "unfinished ");
  await expect(f.text.prepareClose(f.address)).rejects.toMatchObject({ code: "draft_active" });
  expect(first.getSnapshot().closing).toBe(false);
  expect(second.getSnapshot().closing).toBe(false);
  first.transact((text) => text.insert(0, "kept "));
  await first.flush();
  draft.cancel();
  await f.text.prepareClose(f.address);
  expect(first.getSnapshot().closing).toBe(true);
  expect(second.getSnapshot().closing).toBe(true);
  await first.close();
  await second.close();
});

test("placement close waits for SDK-only text queued behind a held durable acknowledgement", async () => {
  const f = await setup();
  const session = await f.open();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  f.hold(async (input) => {
    if (input.operation === "submit" && ++calls === 1) {
      entered.resolve();
      await release.promise;
    }
  });
  session.transact((text) => text.insert(0, "first "));
  await entered.promise;
  session.transact((text) => text.insert(text.length, " second"));
  let closed = false;
  const closing = f.text.prepareClose(f.address).then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  release.resolve();
  await closing;
  expect(session.getSnapshot().text.toString()).toBe("first selected folder second");
  expect(session.getSnapshot().pending).toBe(false);
  await session.close();
});

test("a member registered before open completes participates in the host close barrier", async () => {
  const f = await setup();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.hold(async (input) => {
    if (input.operation === "open") {
      entered.resolve();
      await release.promise;
    }
  });
  const opening = f.open();
  await entered.promise;
  let closed = false;
  const closing = f.text.prepareClose(f.address).then(() => {
    closed = true;
  });
  await Promise.resolve();
  expect(closed).toBe(false);
  release.resolve();
  const session = await opening;
  await closing;
  expect(session.getSnapshot().closing).toBe(true);
  await session.close();
});
