import { expect, test } from "bun:test";
import { pageTargetAvailable, resolvePageMode } from "./page-availability";
import type { WorkbenchPageContribution } from "./page-registry-types";

const page: WorkbenchPageContribution = {
  id: "music",
  ref: { kind: "page", id: "music" },
  path: "music",
  modeId: "boombox",
  modeIds: ["boombox"],
  main: { kind: "view", view: { kind: "view", id: "music" }, cardinality: "one" },
  slots: [],
};
const target = { kind: "page" as const, page: page.ref, mode: { kind: "mode" as const, id: "boombox" } };

test("discovery and direct opens agree on explicit and legacy mode changes", () => {
  expect(resolvePageMode(page, target.mode, "project")).toBe("boombox");
  expect(pageTargetAvailable(target, [page], "project")).toBe(true);
  expect(pageTargetAvailable({ ...target, mode: { kind: "mode", id: "project" } }, [page], "boombox")).toBe(false);
  const legacy = { ...page, modeIds: undefined };
  expect(pageTargetAvailable({ kind: "page", page: legacy.ref }, [legacy], "project")).toBe(true);
});

test("compound discovery checks pages in the mode selected by preceding steps", () => {
  expect(
    pageTargetAvailable({ kind: "compound", targets: [target, { kind: "page", page: page.ref }] }, [page], "project"),
  ).toBe(true);
});
