import { expect, test } from "bun:test";
import { createScopedQueryClient, type ScopedQuery } from "@pstdio/sdk/extensions";

test("a shared observation registry can retain queries with different result types", async () => {
  const root = createScopedQueryClient({ runtimeId: "registry", extensionId: "tool" });
  const entries = new Map<string, ScopedQuery<unknown>>();
  const query = root.query({ id: "account", read: async () => ({ accountId: "a" }) });
  // Runtime registries retain the original typed owner through their unknown-valued slots.
  entries.set("account", query);
  try {
    await query.read();
    expect(entries.get("account")?.getSnapshot().data).toEqual({ accountId: "a" });
  } finally {
    root.dispose();
  }
});
