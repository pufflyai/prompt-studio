import { expect, test } from "bun:test";
import type { RelatedResourceOpenings } from "@pstdio/sdk/extensions";
import { opening, ref, setup } from "./related-resource-openings.fixture";

const fixture = () => {
  const s = setup();
  const page = { kind: "page", id: "files", extensionId: "example" } as const;
  s.workbench.pages.registerPage({
    id: "files",
    ref: page,
    path: "files",
    modeId: "project",
    parentId: "home",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    document: { metadataKey: "file" },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  s.workbench.shellPlacements.registerPlacement({
    id: "manual",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  const resource = (file: string) => ({ ...s.source, metadata: { file } });
  const navigate = (file: string, section?: string) =>
    s.workbench.pageLocations.navigate({
      kind: "page",
      page,
      resource: resource(file),
      ...(section ? { section: { anchors: [{ id: section, heading: section }] } } : {}),
    });
  return { ...s, resource, navigate };
};

test("leaving a document releases its temporary reveal around an existing pin", async () => {
  const s = fixture();
  s.workbench.shellPlacements.openPlacement({ placementId: "manual", resource: ref("document", "kept"), open: "pin" });
  s.workbench.shell.setRegionOpen("side", false);
  s.setResolver(async (resource) => (resource.metadata?.file === "a" ? [opening("automatic")] : []));
  s.navigate("a");
  await s.controller.open(s.resource("a"));
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.navigate("a", "details");
  await s.controller.open(s.resource("a"));
  expect(s.workbench.shell.getRegionState("side").open).toBe(true);
  s.navigate("b");
  await s.controller.open(s.resource("b"));
  expect(s.workbench.layout.listPanelInstances("side").map((tab) => tab.resource?.id)).toEqual(["kept"]);
  expect(s.workbench.shell.getRegionState("side").open).toBe(false);
  s.controller.dispose();
});

test("a pending lookup belongs to its declared document", async () => {
  const s = fixture();
  const pending = Promise.withResolvers<RelatedResourceOpenings>();
  const consulted: unknown[] = [];
  s.setResolver(async (resource) => {
    consulted.push(resource.metadata?.file);
    return resource.metadata?.file === "a" ? pending.promise : [];
  });
  s.navigate("a");
  const a = s.controller.open(s.resource("a"));
  s.navigate("b");
  const b = s.controller.open(s.resource("b"));
  pending.resolve([opening("stale")]);
  await Promise.all([a, b]);
  expect(consulted).toContain("b");
  expect(s.resolved).not.toContain("stale");
  expect(s.workbench.layout.listPanelInstances("side")).toEqual([]);
  s.controller.dispose();
});
