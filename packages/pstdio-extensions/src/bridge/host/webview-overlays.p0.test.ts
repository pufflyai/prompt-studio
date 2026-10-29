import { expect, test } from "bun:test";
import type { WebviewOverlayRequest } from "pstdio-api-contracts/extension-kernel";
import { createHostCapabilityGate } from "../contract";
import { createWebviewOverlayController, webviewOverlayAnchor } from "./webview-overlays";

const menu = {
  op: "show",
  id: "tools",
  anchor: { x: 4, y: 8, width: 24, height: 24 },
  content: {
    kind: "menu",
    label: "Tools",
    items: [
      { id: "hand", label: "Hand" },
      { id: "disabled", label: "Unavailable", disabled: true },
    ],
  },
} as const;

test("a host menu returns only enabled actions and follows its source anchor", async () => {
  let current: WebviewOverlayRequest | undefined;
  const overlays = createWebviewOverlayController((request) => {
    current = request;
  });
  const result = overlays.call(menu);
  overlays.call({ op: "move", id: "tools", anchor: { x: 4, y: 20, width: 24, height: 24 } });
  expect(current?.anchor.y).toBe(20);
  overlays.close("disabled");
  expect(current?.id).toBe("tools");
  overlays.close("hand");
  expect(await result).toEqual({ actionId: "hand" });
  expect(current).toBeUndefined();
});

test("closing, replacing, and disposing a view release its pending overlays", async () => {
  const overlays = createWebviewOverlayController(() => {});
  const first = overlays.call(menu);
  const second = overlays.call({ ...menu, id: "other" });
  expect(await first).toEqual({});
  overlays.call({ op: "close", id: "tools" });
  overlays.dispose();
  expect(await second).toEqual({});
});

test("overlays stay within their declaring frame's capability grant", async () => {
  const first = createWebviewOverlayController(() => {});
  const second = createWebviewOverlayController(() => {});
  const denied = createHostCapabilityGate({ capabilities: { overlays: first.call }, declaredCapabilities: [] });
  await expect(denied.call({ method: "overlays", params: menu })).rejects.toMatchObject({
    code: "undeclared_webview_capability",
  });
  const result = first.call(menu);
  second.call({ op: "close", id: "tools" });
  first.close("hand");
  expect(await result).toEqual({ actionId: "hand" });
  expect(() => first.call({ ...menu, anchor: { ...menu.anchor, x: Number.NaN } })).toThrow();
});

test("overlay anchors include the iframe's offset and rendered scale", () => {
  expect(
    webviewOverlayAnchor(
      { bounds: { x: 100, y: 50, width: 112, height: 400 }, width: 56, height: 200 },
      { x: 4, y: 8, width: 24, height: 24 },
    ),
  ).toEqual({ x: 108, y: 66, width: 48, height: 48 });
});
