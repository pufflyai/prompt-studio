import { expect, test } from "bun:test";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { createExampleStore } from "./example-store";

test("keeps a remote edit when a local write acknowledgement arrives after its change event", async () => {
  const reply = (state: { query: string; folder: string }) => ({
    outcome: { ok: true, value: { name: "pigeon", state } },
  });
  const write = Promise.withResolvers<unknown>();
  const writing = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  const reads: ReturnType<typeof Promise.withResolvers<unknown>>[] = [];
  let notify = (_event: unknown) => {};
  let initialized = false;
  const host = {
    extensionId: "pstdio.extension-lab",
    onEvent(_scope: string, listener: (event: unknown) => void) {
      notify = listener;
      return () => {};
    },
    async call(_method: string, input: { commandId: string }) {
      if (!input.commandId.endsWith("state.read")) {
        writing.resolve();
        return write.promise;
      }
      if (!initialized) {
        initialized = true;
        return reply({ query: "", folder: "Inbox" });
      }
      const read = Promise.withResolvers<unknown>();
      reads.push(read);
      return read.promise;
    },
  } as unknown as GuestHost;
  const store = createExampleStore("pigeon", { query: "", folder: "Inbox" });
  const disconnect = store.connect(
    host,
    {} as never,
    (error) => {
      throw error;
    },
    ready.resolve,
  );
  await ready.promise;
  const saving = store.setState({ query: "local" });
  await writing.promise;
  notify({ type: "changed", id: "pstdio.extension-lab.event.examples.changed" });
  write.resolve(reply({ query: "local", folder: "Inbox" }));
  for (let index = 0; index < 8; index++) await Promise.resolve();
  for (const read of reads) read.resolve(reply({ query: "local", folder: "Sent" }));
  await saving;
  for (let index = 0; index < 8; index++) await Promise.resolve();
  expect(store.getState()).toEqual({ query: "local", folder: "Sent" });
  disconnect();
});
