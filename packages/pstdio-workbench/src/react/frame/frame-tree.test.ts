import { describe, expect, test } from "bun:test";
import { classicFrame, defineFrame } from "../../core";
import { resolveMainFrameNode } from "./frame-tree";

describe("resolveMainFrameNode", () => {
  test("selects the smallest classic subtree containing primary chrome and the secondary binding", () => {
    expect(resolveMainFrameNode(classicFrame).id).toBe("body");
  });

  test("follows bindings instead of relying on classic split ids", () => {
    const frame = defineFrame({
      id: "alternate",
      root: {
        kind: "split",
        id: "alternate-root",
        direction: "row",
        children: [
          { kind: "slot", id: "editor-header", owner: "resource", role: "projection" },
          { kind: "slot", id: "editor", owner: "resource", role: "panels" },
          { kind: "slot", id: "console", owner: "resource", role: "panels" },
        ],
      },
      primary: "editor",
      secondary: { slot: "console", persistence: "derived", candidates: "scoped" },
    });

    expect(resolveMainFrameNode(frame).id).toBe("alternate-root");
  });
});
