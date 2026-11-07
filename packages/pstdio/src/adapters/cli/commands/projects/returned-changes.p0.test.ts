import { expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./returned-changes";

const args = (action?: "apply" | "discard" | "dismiss") =>
  ({ id: "project", action, _: [], $0: "pst" }) as Arguments<{ id: string; action?: "apply" | "discard" | "dismiss" }>;

test("lists held changes and how to apply or discard them", async () => {
  const log = mock();
  await createHandler({
    status: async () => ({
      state: "synced",
      offlineReady: true,
      away: {
        state: "held",
        total: 2,
        deletions: 1,
        records: [
          { extensionId: "tickets", recordId: "r1", label: "PS-1", fields: [], deleted: true, created: false },
          { extensionId: "tickets", recordId: "r2", fields: ["/title"], deleted: false, created: false },
        ],
      },
    }),
    resolve: async () => ({ ok: true }),
    log,
  })(args());
  expect(log.mock.calls.map(([line]) => line)).toEqual([
    "2 changed records (1 deleted) are held for review. Run `pst projects returned-changes project apply` or `discard`.",
    "  PS-1 (deleted)",
    "  r2 /title",
  ]);
});

test("applies or discards held changes on this device", async () => {
  const resolve = mock(async () => ({ ok: true }));
  const log = mock();
  const handler = createHandler({ status: async () => ({ state: "synced", offlineReady: true }), resolve, log });
  await handler(args("apply"));
  await handler(args("discard"));
  expect(resolve.mock.calls as unknown[]).toEqual([
    ["project", "apply"],
    ["project", "discard"],
  ]);
  expect(log).toHaveBeenCalledWith("Held changes upload now.");
});

test("says when nothing is waiting", async () => {
  const log = mock();
  await createHandler({
    status: async () => ({ state: "synced", offlineReady: true }),
    resolve: async () => ({ ok: true }),
    log,
  })(args());
  expect(log).toHaveBeenCalledWith("No changes from time away.");
});
