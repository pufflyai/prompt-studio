import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { resolveSessionIndicatorColor, type SessionCompletionStatus } from "@pstdio/ui";
import { search } from "../../../../extensions/pstdio-session-browser/src/browse";
import { WorkbenchResourcePaletteIcon } from "../../../pstdio-workbench/src/react/command-palette/resource-palette";

test("actual Sessions search projects Main status colors and running icon into the palette primary glyph", async () => {
  const statuses: SessionCompletionStatus[] = [
    "in_progress",
    "queued",
    "completed",
    "failed",
    "cancelled",
    "disconnected",
    "awaiting_input",
  ];
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
  for (const [index, status] of statuses.entries()) {
    const item = result.items[index];
    const icon = WorkbenchResourcePaletteIcon({ icon: item.icon, indicator: item.indicator });
    expect(icon?.props.color).toBe(resolveSessionIndicatorColor(status));
    expect(icon?.props["aria-label"]).toBe(`Session status: ${status}`);
    expect(item.icon).toBe("message-circle");
  }
  expect(result.items[0].indicator?.icon).toBe("loader-circle");
});
