import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, navigate, panel, resource } from "./placement-lifecycle-test-support";

test("shared mode resources restore on reload and keep their owner state on another page", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("shared"), open: "pin" });
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getLayout().regions.side.widgets.map((item) => item.resource?.id)).toEqual(["shared"]);
  await restored.navigation.openTarget(navigate("beta"));
  expect(restored.layout.getLayout().regions.side.widgets.map((item) => item.resource?.id)).toEqual(["shared"]);
  await restored.navigation.openTarget({ kind: "panel", panel, resource: resource("next"), open: "preview" });
  expect(restored.layout.getLayout().regions.side.widgets.map((item) => item.resource?.id)).toEqual(["shared", "next"]);
});

test("closing a shared mode panel persists for every page owned by that mode", async () => {
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const first = harness(saved);
  await first.navigation.openTarget(navigate("alpha"));
  await first.navigation.openTarget({ kind: "panel", panel, resource: resource("shared"), open: "pin" });
  await first.navigation.openTarget(navigate("beta"));
  first.closePlacement(first.modePlacements.resolvePlacements("edit")[0]!.identity);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.modePlacements.resolvePlacements("edit")).toHaveLength(0);
  expect(restored.layout.getLayout().regions.side.widgets).toHaveLength(0);
});
