import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { search } from "./browse";

test("Sessions search supplies status colors, accessible labels and running icons", async () => {
  const statuses = ["in_progress", "queued", "completed", "failed", "cancelled", "disconnected", "awaiting_input"];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async () => ({
          items: statuses.map((status, index) => ({
            id: `s${index}`,
            title: status,
            status,
            updatedAt: new Date().toISOString(),
          })) as never,
          nextCursor: null,
        }),
      },
    },
  });
  const result = await search.query(ctx, {
    query: "",
    limit: 20,
    providerId: "sessions",
    renderer: { rendererId: "list" },
  });
  const colors = ["fg.info", "fg.info", "fg.success", "fg.error", "fg.warning", "fg.warning", "fg.warning"];
  for (const [index, status] of statuses.entries()) {
    const item = result.items[index];
    expect(item.indicator?.color).toBe(colors[index]);
    expect(item.indicator?.label).toBe(`Session status: ${status}`);
    expect(item.icon).toBe("message-circle");
  }
  expect(result.items[0].indicator?.icon).toBe("loader-circle");
});
