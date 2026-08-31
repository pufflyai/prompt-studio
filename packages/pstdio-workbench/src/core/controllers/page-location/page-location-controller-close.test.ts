import { describe, expect, test } from "bun:test";
import { createPageLocationHarness } from "./page-location-controller.test-support";

describe("page location placement close", () => {
  test("closes a mode-owned placement without changing the canonical location", () => {
    const harness = createPageLocationHarness();
    harness.controller.boot("p1");
    const location = harness.registry.store.getState().location!;
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;

    const result = harness.controller.closePlacement({
      kind: "mode",
      modeId: "project",
      placementId: "shared",
      instanceKey: "default",
    });

    expect(result).toEqual({ ok: true, location });
    expect(harness.registry.store.getState().placements.map((candidate) => candidate.identity.kind)).toEqual([
      "shell",
      "page",
    ]);
    expect(harness.registry.store.getState().location).toBe(location);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes);
  });
});
