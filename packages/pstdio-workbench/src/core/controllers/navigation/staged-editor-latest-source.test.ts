import { expect, test } from "bun:test";
import { harness, navigate, page, resource } from "../composition/placement-lifecycle-test-support";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

function create(policy?: "per-resource" | "multiple") {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = policy;
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "edit",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
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
}
const doc = (id: string, line: number, parent: string) => ({
  kind: "page" as const,
  page: page("documents"),
  resource: { ...resource(id), metadata: { path: `${id}.ts` } },
  open: "pin" as const,
  position: { line, column: 1 },
  parent: navigate(parent),
});
for (const policy of [undefined, "multiple", "per-resource"] as const)
  for (const reused of [false, true])
    for (const leave of [false, true]) {
      test(`latest staged source and parent survive ${policy ?? "omitted"} policy, ${reused ? "reused" : "fresh"} editor, and ${leave ? "inactive" : "active"} owner`, async () => {
        const w = create(policy);
        if (reused) await w.navigation.openTarget(doc("a", 1, "old"));
        await w.navigation.openTarget({
          kind: "compound",
          targets: [
            doc("a", 10, "alpha"),
            doc("b", 20, "gamma"),
            doc("a", 30, "delta"),
            doc("b", 40, "theta"),
            ...(leave ? [navigate("beta")] : []),
          ],
        });
        const tabs = openOwnerLayouts(w).flatMap((o) => Object.values(o.layout.regions).flatMap((r) => r.widgets));
        for (const [id, line, parent] of [
          ["a", 30, "delta"],
          ["b", 40, "theta"],
        ] as const) {
          const t = tabs.find((t) => t.resource?.id === id)!;
          expect(t.position?.line).toBe(line);
          expect(t.pageContext?.parent?.resource?.id).toBe(parent);
          expect(t.pinned).toBe(true);
        }
        const state = w.pages.store.getState(),
          layout = w.layout.getLayout(),
          snapshot = JSON.stringify(openOwnerLayouts(w));
        await expect(
          w.navigation.openTarget({
            kind: "compound",
            targets: [doc("a", 99, "invalid"), { kind: "page", page: page("missing") }],
          }),
        ).rejects.toThrow();
        expect(w.pages.store.getState()).toBe(state);
        expect(w.layout.getLayout()).toBe(layout);
        expect(JSON.stringify(openOwnerLayouts(w))).toBe(snapshot);
      });
    }
