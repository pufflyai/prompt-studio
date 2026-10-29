import { expect, test } from "bun:test";
import { createWebviewClient } from "./webview-client";

test("host overlays keep the anchor current and release it when the caller closes", async () => {
  const calls: unknown[] = [];
  const client = createWebviewClient({
    extensionId: "test.editor",
    call: async (method, params?: unknown) => {
      calls.push({ method, params });
      return {} as never;
    },
    onEvent: () => () => {},
  });
  await client.overlays.show({
    id: "tools",
    anchor: { x: 4, y: 8, width: 24, height: 24 },
    content: { kind: "menu", label: "Tools", items: [{ id: "hand", label: "Hand" }] },
  });
  await client.overlays.move("tools", { x: 4, y: 16, width: 24, height: 24 });
  await client.overlays.close("tools");
  expect(calls).toEqual([
    {
      method: "overlays",
      params: {
        op: "show",
        id: "tools",
        anchor: { x: 4, y: 8, width: 24, height: 24 },
        content: { kind: "menu", label: "Tools", items: [{ id: "hand", label: "Hand" }] },
      },
    },
    { method: "overlays", params: { op: "move", id: "tools", anchor: { x: 4, y: 16, width: 24, height: 24 } } },
    { method: "overlays", params: { op: "close", id: "tools" } },
  ]);
});
