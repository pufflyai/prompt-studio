import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchModuleContext } from "../../core";
import { registerRelatedResourcePreviews } from "./related-resource-previews";
import type { ResourceLinksService } from "./resource-links-types";

const ref = (type: string, id: string): ResourceRef => ({ type, id, extensionId: "example", projectId: "project" });
const setup = (links: ResourceRef[], input: Parameters<typeof createWorkbench>[0] = {}) => {
  const workbench = createWorkbench(input);
  workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
  workbench.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "home",
    ref: { kind: "page", id: "home", extensionId: "example" },
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "documents",
    ref: { kind: "page", id: "documents", extensionId: "example" },
    path: "documents",
    modeId: "project",
    parentId: "home",
    resource: {
      kinds: [
        { kind: "resource-kind", id: "document" },
        { kind: "resource-kind", id: "drawing" },
      ],
    },
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  const source = ref("document", "source");
  const target = (resource: ResourceRef) => ({
    kind: "page" as const,
    page: { kind: "page" as const, id: "documents", extensionId: "example" },
    resource,
  });
  workbench.pageLocations.setProject("project");
  workbench.pageLocations.navigate(target(source));
  const service: ResourceLinksService = {
    list: async () => ({ items: links.map((resource) => ({ source: resource, target: source })) }),
    resolve: async (resources) => resources.map((resource) => ({ resource, target: target(resource) })),
    search: async () => [],
    add: async () => {},
    remove: async () => {},
    subscribe: () => () => {},
  };
  const controller = registerRelatedResourcePreviews(workbench as WorkbenchModuleContext, {
    canonicalize: (resource) => resource,
    createService: () => service,
  });
  return { workbench, source, service, controller, target };
};

test("opens direct linked resources of arbitrary kinds as previews without changing the route or focus", async () => {
  const { workbench, source, controller } = setup([
    ref("drawing", "first"),
    ref("drawing", "second"),
    ref("document", "note"),
  ]);
  const location = workbench.pages.store.getState().location;
  const active = workbench.layout.getLayout().activeWidgetId;
  await controller.open(source);
  expect(workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual(["note"]);
  expect(
    workbench.layout.listPanelInstances("side").every((panel) => panel.tabRetention === "preview" && !panel.pinned),
  ).toBe(true);
  expect(workbench.pages.store.getState().location).toEqual(location);
  expect(workbench.layout.getLayout().activeWidgetId).toBe(active);
  controller.dispose();
});

test("the default-on preference disables every automatic related preview", async () => {
  const { workbench, source, controller } = setup([ref("drawing", "drawing")]);
  expect(workbench.preferences.getValue("workbench.openRelatedResources")).toBe(true);
  await workbench.preferences.setValue("workbench.openRelatedResources", false, { scope: "user" });
  await controller.open(source);
  expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  controller.dispose();
});

test("a later navigation cancels stale lookups and related previews do not recurse", async () => {
  const { workbench, source, service, controller, target } = setup([ref("drawing", "drawing")]);
  let finish!: (value: Awaited<ReturnType<ResourceLinksService["list"]>>) => void;
  service.list = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = controller.open(source);
  const finishOld = finish;
  await workbench.navigation.openTarget(target(ref("document", "next")));
  finishOld({ items: [{ source, target: ref("drawing", "late") }] });
  await pending;
  expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  controller.dispose();
});

test("owner relationships use the same preview path and preserve pinned resources", async () => {
  const { workbench, source, controller, target } = setup([]);
  const drawing = ref("drawing", "drawing");
  workbench.resources.registerProvider({
    id: "drawings",
    kind: "drawing",
    list: () => [],
    related: () => [{ resource: drawing, target: target(drawing) }],
  });
  await controller.open(source);
  const panel = workbench.layout.listPanelInstances("side")[0]!;
  workbench.shellPlacements.updatePlacement(panel.placementIdentity!, { open: "pin" });
  await controller.open(source);
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(1);
  expect(workbench.layout.listPanelInstances("side")[0]?.tabRetention).toBe("persistent");
  controller.dispose();
});

test("project switches discard panel lookups even when neither page has a resource", async () => {
  const { workbench, source, service, controller } = setup([]);
  workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "home", extensionId: "example" } });
  let finish!: (value: Awaited<ReturnType<ResourceLinksService["list"]>>) => void;
  service.list = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = controller.open(source);
  workbench.pageLocations.setProject("next-project");
  finish({ items: [{ source, target: ref("drawing", "late") }] });
  await pending;
  expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  controller.dispose();
});

test("disabling related resources discards pending results across re-enablement", async () => {
  const { workbench, source, service, controller } = setup([]);
  let finish!: (value: Awaited<ReturnType<ResourceLinksService["list"]>>) => void;
  service.list = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = controller.open(source);
  await workbench.preferences.setValue("workbench.openRelatedResources", false, { scope: "user" });
  await workbench.preferences.setValue("workbench.openRelatedResources", true, { scope: "user" });
  finish({ items: [{ source, target: ref("drawing", "late") }] });
  await pending;
  expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  controller.dispose();
});

test("opening and selecting ordinary panels loads their links without recursive previews", async () => {
  const { workbench, service, controller } = setup([]);
  const source = ref("document", "panel");
  const queried: string[] = [];
  service.list = async ({ resource }) => {
    queried.push(resource.id);
    return { items: [{ source: resource, target: ref("drawing", "related") }] };
  };
  workbench.shellPlacements.registerPlacement({
    id: "documents",
    region: "secondary",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  const panel = workbench.shellPlacements.openPlacement({ placementId: "documents", resource: source, open: "pin" });
  expect(queried).toEqual([source.id]);
  await controller.open(source);
  expect(queried).toEqual([source.id]);
  const related = workbench.layout.listPanelInstances("side")[0]!;
  workbench.layout.activatePanel(related.instanceId);
  expect(queried).toEqual([source.id, "related"]);
  await controller.open(ref("drawing", "related"));
  expect(queried).toEqual([source.id, "related"]);
  expect(panel).toBeDefined();
  controller.dispose();
});

test("pinned related resources remain pinned after a workbench reload", async () => {
  const saved = new Map<string | undefined, ReturnType<ReturnType<typeof createWorkbench>["layout"]["getLayout"]>>();
  const input = {
    layoutPersistence: {
      getLayout: (scope?: string) => saved.get(scope),
      setLayout: (layout: ReturnType<ReturnType<typeof createWorkbench>["layout"]["getLayout"]>, scope?: string) => {
        saved.set(scope, layout);
      },
    },
  };
  const first = setup([ref("drawing", "drawing")], input);
  await first.controller.open(first.source);
  first.workbench.shellPlacements.updatePlacement(
    first.workbench.layout.listPanelInstances("side")[0]!.placementIdentity!,
    { open: "pin" },
  );
  const second = setup([ref("drawing", "drawing")], input);
  await second.controller.open(second.source);
  expect(second.workbench.layout.listPanelInstances("side")[0]?.tabRetention).toBe("persistent");
  second.controller.dispose();
  first.controller.dispose();
});

test("refreshing the routed resource does not replace an explicitly opened draft", async () => {
  const { workbench, source, service, controller } = setup([]);
  let reads = 0;
  service.list = async () => {
    reads++;
    return { items: [] };
  };
  workbench.shellPlacements.registerPlacement({
    id: "draft",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "draft" }],
        cardinality: "many",
      },
    },
  });
  workbench.shellPlacements.openPlacement({
    placementId: "draft",
    resource: { type: "draft", id: "new" },
    open: "preview",
  });
  const readsBeforeRefresh = reads;
  workbench.pageLocations.replay({
    ...workbench.pages.store.getState().location!,
    resource: { ...source, label: "Updated title" },
  });
  await Promise.resolve();
  expect(reads).toBe(readsBeforeRefresh);
  controller.dispose();
});

test("automatic related previews never replace their initiating preview in the same tray", async () => {
  const { workbench, service, controller, target } = setup([]);
  const initiating = ref("drawing", "initiating");
  const related = ref("document", "related");
  service.list = async () => ({ items: [{ source: initiating, target: related }] });
  service.resolve = async () => [{ resource: related, target: target(related) }];
  workbench.shellPlacements.registerPlacement({
    id: "source-preview",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "drawing" }],
        cardinality: "many",
      },
    },
  });
  workbench.shellPlacements.openPlacement({ placementId: "source-preview", resource: initiating, open: "preview" });
  await controller.open(initiating);
  expect(workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual(["initiating"]);
  const source = workbench.layout.listPanelInstances("side")[0]!;
  workbench.movePanel(source.instanceId, "secondary");
  await controller.open(initiating);
  expect(workbench.layout.listPanelInstances("secondary").map((panel) => panel.resource?.id)).toEqual(["initiating"]);
  expect(workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual(["related"]);
  controller.dispose();
});

test("related projections keep their destination tray when the same view already previews another resource", async () => {
  const { workbench, source, service, controller } = setup([ref("document", "first")]);
  await controller.open(source);
  workbench.pinPlacement(workbench.layout.listPanelInstances("side")[0]!.placementIdentity!);
  const page = { kind: "page", extensionId: "example", id: "secondary-documents" } as const;
  workbench.pages.registerPage({
    id: "secondary-documents",
    ref: page,
    path: "secondary-documents",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [
      {
        id: "documents",
        region: "secondary",
        item: {
          kind: "binding",
          binding: {
            view: { kind: "view", id: "document" },
            kinds: [{ kind: "resource-kind", id: "document" }],
            cardinality: "many",
          },
        },
      },
    ],
  });
  const initiating = ref("drawing", "initiating");
  const related = ref("document", "second");
  service.list = async () => ({ items: [{ source: initiating, target: related }] });
  service.resolve = async () => [
    {
      resource: related,
      target: { kind: "panel", panel: { kind: "page-slot", page, id: "documents" }, resource: related },
    },
  ];
  workbench.shellPlacements.registerPlacement({
    id: "source-preview",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "drawing" }],
        cardinality: "many",
      },
    },
  });
  workbench.shellPlacements.openPlacement({ placementId: "source-preview", resource: initiating, open: "preview" });
  await controller.open(initiating);
  expect(workbench.layout.listPanelInstances("side").map((panel) => panel.resource?.id)).toEqual([
    "initiating",
    "first",
  ]);
  expect(workbench.layout.listPanelInstances("secondary").map((panel) => panel.resource?.id)).toEqual(["second"]);
  controller.dispose();
});
