import { expect, test } from "bun:test";
import { harness, navigate, openFile, resource } from "../composition/placement-lifecycle-test-support";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

for (const policy of [undefined, "multiple", "per-resource"] as const) {
  for (const owner of ["page", "shell"] as const) {
    for (const opening of ["compound", "separate", "same-owner"] as const) {
      test(`${policy ?? "omitted"} policy keeps ${owner} opens in the correct owner during ${opening} navigation`, async () => {
        const w = harness();
        w.views.getView("editor")!.instancePolicy = policy;
        w.shellPlacements.registerPlacement({
          id: "inspector",
          region: "secondary",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "file" }],
              view: { kind: "view", id: "editor" },
              cardinality: "many",
            },
          },
        });
        const target =
          owner === "shell"
            ? {
                kind: "panel" as const,
                panel: { kind: "shell-placement" as const, id: "inspector" },
                resource: resource("a"),
                open: "pin" as const,
              }
            : { ...openFile("a"), open: "pin" as const };
        await w.navigation.openTarget(navigate("alpha"));
        await w.navigation.openTarget(target);
        const original = w.layout.getLayout().activeWidgetId;
        if (opening === "compound")
          await w.navigation.openTarget({ kind: "compound", targets: [navigate("beta"), target] });
        else if (opening === "separate") {
          await w.navigation.openTarget(navigate("beta"));
          await w.navigation.openTarget(target);
        } else await w.navigation.openTarget({ kind: "compound", targets: [navigate("alpha"), target] });
        const stays = opening === "same-owner" || policy === "per-resource";
        expect(w.pages.store.getState().location?.resource?.id).toBe(stays ? "alpha" : "beta");
        const editors = openOwnerLayouts(w).flatMap((o) =>
          Object.values(o.layout.regions).flatMap((r) =>
            r.widgets
              .filter((t) => t.viewId === "editor" && t.resource?.id === "a")
              .map((t) => `${o.scope}:${t.widgetId}`),
          ),
        );
        expect(new Set(editors).size).toBe(stays ? 1 : 2);
        expect(w.layout.getActivePanel()?.resource?.id).toBe("a");
        expect(w.focus.getActiveRegion()).toBe(owner === "shell" ? "secondary" : "main");
        if (stays) expect(w.layout.getLayout().activeWidgetId).toBe(original);
      });
    }
  }
}
