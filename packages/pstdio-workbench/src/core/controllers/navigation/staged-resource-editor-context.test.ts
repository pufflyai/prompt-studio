import { expect, test } from "bun:test";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { harness, navigate, page, panel, resource } from "../composition/placement-lifecycle-test-support";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

const create = (input?: Parameters<typeof harness>[1]) => {
  const w = harness(undefined, input);
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "edit",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "documents",
    ref: page("documents"),
    path: "documents",
    modeId: "edit",
    parentId: "collection",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  return w;
};
const doc = (id: string, line = 10) => ({
  kind: "page" as const,
  page: page("documents"),
  resource: { ...resource(id), metadata: { path: `${id}.ts` } },
  open: "pin" as const,
  position: { line, column: 1 },
  parent: navigate("alpha"),
});

test("an earlier compound Main editor reopen retains its requested position", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget({ kind: "compound", targets: [doc("a", 20), navigate("beta")] });
  const saved = openOwnerLayouts(w)
    .flatMap((o) => Object.values(o.layout.regions).flatMap((r) => r.widgets))
    .find((t) => t.widgetId === id);
  expect(saved?.position?.line).toBe(20);
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.layout.getLayout().regions.main.widgets.find((t) => t.widgetId === id)?.position?.line).toBe(20);
});

test("a newly staged Main editor retains its requested position", async () => {
  const w = create();
  await w.navigation.openTarget({ kind: "compound", targets: [doc("a", 20), navigate("beta")] });
  const saved = openOwnerLayouts(w)
    .flatMap((o) => Object.values(o.layout.regions).flatMap((r) => r.widgets))
    .find((t) => t.resource?.id === "a");
  expect(saved?.position?.line).toBe(20);
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
  expect(w.layout.getLayout().regions.main.widgets.find((t) => t.resource?.id === "a")?.position?.line).toBe(20);
});

test("separate Main reopen commits its parent and source position before leaving", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget({ ...doc("a", 20), parent: navigate("gamma") });
  await w.navigation.openTarget(navigate("beta"));
  const saved = openOwnerLayouts(w)
    .flatMap((o) => Object.values(o.layout.regions).flatMap((r) => r.widgets))
    .find((t) => t.widgetId === id);
  expect(saved?.position?.line).toBe(20);
  expect(saved?.pageContext?.parent?.resource?.id).toBe("gamma");
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("gamma");
});

test("an earlier compound Main reopen retains its requested parent", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget({
    kind: "compound",
    targets: [{ ...doc("a"), parent: navigate("gamma") }, navigate("beta")],
  });
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("gamma");
});

test("a newly staged Main editor retains its contextual ancestor", async () => {
  const w = create();
  w.pages.getPage("collection")!.parentId = "workspace";
  const target = {
    ...doc("a"),
    parent: { kind: "page" as const, page: page("collection"), parent: navigate("alpha") },
  };
  await w.navigation.openTarget({ kind: "compound", targets: [target, navigate("beta")] });
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
  const ancestor = w.pages.store.getState().location!.parent!.parent!;
  expect(w.pageLocations.navigate({ kind: "page", page: ancestor.page, resource: ancestor.resource }).ok).toBe(true);
});

for (const reused of [false, true]) {
  for (const leave of [false, true]) {
    test(`${reused ? "reused" : "new"} compound Main documents keep separate contexts when ${leave ? "leaving" : "staying"}`, async () => {
      const w = create();
      if (reused) await w.navigation.openTarget({ ...doc("a", 1), parent: navigate("old") });
      await w.navigation.openTarget({
        kind: "compound",
        targets: [
          doc("a", 10),
          {
            ...doc("b", 20),
            parent: navigate("gamma"),
          },
          ...(leave ? [navigate("beta")] : []),
        ],
      });
      const tabs = openOwnerLayouts(w).flatMap((owner) =>
        Object.values(owner.layout.regions).flatMap((region) => region.widgets),
      );
      const a = tabs.find((tab) => tab.resource?.id === "a")!;
      expect(a.position?.line).toBe(10);
      expect(a.pageContext?.parent?.resource?.id).toBe("alpha");
      const id = a.widgetId;
      await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
      expect(w.layout.getLayout().activeWidgetId).toBe(id);
      expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
      expect(w.pages.store.getState().location?.position?.line).toBe(10);
    });
  }
}

test("a later compound panel reopen uses its own staged Main context", async () => {
  const w = create();
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      doc("a", 10),
      {
        ...doc("b", 20),
        parent: navigate("gamma"),
      },
      { kind: "panel", panel, resource: doc("a").resource },
    ],
  });
  expect(w.pages.store.getState().location?.resource?.id).toBe("a");
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
  expect(w.pages.store.getState().location?.position?.line).toBe(10);
});

test("an identity-only panel reopen does not synthesize a document position", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("a") });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.resource?.metadata).toBeUndefined();
  expect(w.pages.store.getState().location?.position).toBeUndefined();
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
});

test("an explicit position without document metadata still rejects atomically", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  await w.navigation.openTarget(navigate("beta"));
  const layout = w.layout.getLayout();
  const state = w.pages.store.getState();
  await expect(w.navigation.openTarget({ ...doc("a"), resource: resource("a") })).rejects.toThrow(
    "invalid source position",
  );
  expect(w.layout.getLayout()).toBe(layout);
  expect(w.pages.store.getState()).toBe(state);
});

test("source inheritance uses the host-normalized resource address", async () => {
  const w = create({
    pageResources: {
      ...defaultPageResourceCodec,
      normalize: (value) => ({ ...value, metadata: value.metadata ?? { path: `${value.id}.ts` } }),
    },
  });
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("a") });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.resource?.metadata?.path).toBe("a.ts");
  expect(w.pages.store.getState().location?.position?.line).toBe(10);
});
