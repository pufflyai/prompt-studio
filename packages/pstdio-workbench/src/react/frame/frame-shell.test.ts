import { describe, expect, test } from "bun:test";
import { defineFrame, type WorkbenchLayoutNode } from "../../core";
import { resolveFrameShell } from "./frame-shell";

const shellFrame = defineFrame({
  id: "shell",
  root: {
    kind: "split",
    id: "root",
    direction: "row",
    children: [
      { kind: "slot", id: "main", owner: "resource", role: "panels" },
      {
        kind: "slot",
        id: "inspector",
        owner: "project",
        role: "panels",
        presentations: ["docked", "floating", "hidden"],
      },
      { kind: "slot", id: "overlay", owner: "project", role: "transient" },
    ],
  },
  primary: "main",
});

const resolve = (nodes: Record<string, WorkbenchLayoutNode> = {}) => resolveFrameShell(shellFrame, nodes);

describe("resolveFrameShell", () => {
  test("uses the first declared presentation by default", () => {
    const shell = resolve();

    expect(shell.flow).toMatchObject({
      kind: "split",
      id: "root",
      children: [{ id: "main" }, { id: "inspector" }],
    });
    expect(shell.floating).toEqual([]);
  });

  test("separates floating and transient layers from the flow tree", () => {
    const shell = resolve({ inspector: { presentation: "floating" } });

    expect(shell.flow).toEqual(shellFrame.slots.main);
    expect(shell.floating.map((slot) => slot.id)).toEqual(["inspector"]);
    expect(shell.transient.map((slot) => slot.id)).toEqual(["overlay"]);
  });

  test("keeps a docked presented slot in its declared tree position", () => {
    const shell = resolve({ inspector: { presentation: "docked" } });

    expect(shell.flow).toMatchObject({
      kind: "split",
      id: "root",
      children: [{ id: "main" }, { id: "inspector" }],
    });
    expect(shell.floating).toEqual([]);
  });

  test("removes a hidden slot from both the flow and floating layers", () => {
    const shell = resolve({ inspector: { presentation: "hidden" } });

    expect(shell.flow).toEqual(shellFrame.slots.main);
    expect(shell.floating).toEqual([]);
    expect(shell.transient.map((slot) => slot.id)).toEqual(["overlay"]);
  });
});
