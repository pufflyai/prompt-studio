import { expect, test } from "bun:test";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingPages } from "../../../examples/windowing/resources";
import { createWorkbench } from "../../workbench-core";
import {
  floatingBubblePositions,
  nextFloatingBubblePosition,
  normalizeFloatingBubblePosition,
} from "./floating-bubble-position";

test("normalizes saved positions to the eight edge anchors", () => {
  expect(normalizeFloatingBubblePosition({ x: 0.1, y: 0.6 })).toEqual({ x: 0, y: 0.5 });
  expect(normalizeFloatingBubblePosition({ x: 4, y: -2 })).toEqual({ x: 1, y: 0 });
  expect(normalizeFloatingBubblePosition(undefined)).toEqual({ x: 1, y: 1 });
  expect(normalizeFloatingBubblePosition({ x: Number.NaN, y: 0 })).toEqual({ x: 1, y: 1 });
});

test("one mode anchor survives page navigation and reload without entering page geometry", async () => {
  const fixture = createWindowingFixture();
  const core = fixture.workbench;
  core.sidePanel.setBubblePosition({ x: 0, y: 0.5 });
  core.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[1],
  });
  expect(core.sidePanel.getBubblePosition()).toEqual({ x: 0, y: 0.5 });
  await fixture.reload();
  expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 0, y: 0.5 });
  for (const scope of fixture.persistence.layout.listScopes!("windowing-project")) {
    if (scope.includes("/owner/page/"))
      expect(fixture.persistence.layout.getLayout(scope)?.regions.side.bubblePosition).toBeUndefined();
  }
  await fixture.dispose();
});

test("the position command admits only the eight anchors before changing layout", async () => {
  const core = createWorkbench();
  const command = "workbench.setFloatingBubblePosition";
  for (const position of Object.values(floatingBubblePositions)) {
    await core.commands.executeCommand(command, position);
    expect(core.sidePanel.getBubblePosition()).toEqual(position);
  }
  await core.commands.executeCommand(command, { x: 0, y: 0.5 });
  expect(core.sidePanel.getBubblePosition()).toEqual({ x: 0, y: 0.5 });
  for (const value of [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 1 }, { x: 1 }, null]) {
    const before = core.layout.getLayout();
    await expect(core.commands.executeCommand(command, value)).rejects.toThrow("anchor");
    expect(core.layout.getLayout()).toBe(before);
  }
  await core.dispose();
});

test("keyboard movement follows the edge anchors without using the interior center", () => {
  expect(nextFloatingBubblePosition({ x: 1, y: 1 }, "ArrowLeft")).toEqual({ x: 0.5, y: 1 });
  expect(nextFloatingBubblePosition({ x: 0.5, y: 1 }, "ArrowUp")).toEqual({ x: 0.5, y: 0 });
  expect(nextFloatingBubblePosition({ x: 0, y: 0.5 }, "ArrowRight")).toEqual({ x: 1, y: 0.5 });
  expect(nextFloatingBubblePosition({ x: 0, y: 0 }, "Home")).toEqual({ x: 1, y: 1 });
});

test("each mode restores its own bubble anchor", async () => {
  const fixture = createWindowingFixture("windowing", { pageModes: true });
  const core = fixture.workbench;
  core.sidePanel.setBubblePosition({ x: 0, y: 0.5 });
  expect(core.pageLocations.switchMode("boombox").ok).toBe(true);
  expect(core.sidePanel.getBubblePosition()).toEqual({ x: 1, y: 1 });
  core.sidePanel.setBubblePosition({ x: 0.5, y: 0 });
  expect(core.pageLocations.switchMode("windowing").ok).toBe(true);
  expect(core.sidePanel.getBubblePosition()).toEqual({ x: 0, y: 0.5 });
  expect(core.pageLocations.switchMode("boombox").ok).toBe(true);
  expect(core.sidePanel.getBubblePosition()).toEqual({ x: 0.5, y: 0 });
  await fixture.reload();
  expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 0.5, y: 0 });
  await fixture.dispose();
});
