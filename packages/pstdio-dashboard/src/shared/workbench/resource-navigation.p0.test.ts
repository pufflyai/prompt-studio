import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { openDashboardResource } from "./resource-openers";

for (const transition of [
  "newer opening",
  "explicit round trip",
  "project round trip",
  "metadata replay",
  "unavailable default",
  "already unavailable default",
] as const) {
  test(`pending resource navigation respects a ${transition}`, async () => {
    const projectId = "navigation-project";
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const page = (id: string) => ({ kind: "page" as const, extensionId: "example.viewer", id });
    let configured: ReturnType<typeof page> | undefined =
      transition === "already unavailable default" ? undefined : page("desk");
    const w = createWorkbench({ defaultPage: () => configured });
    w.modes.registerMode({ id: "project", activate() {} });
    w.views.registerView({ id: "reader", title: "Reader", body: { kind: "react", render: () => null } });
    for (const id of ["desk", "alternate", "inspect"])
      w.pages.registerPage({
        id,
        ref: page(id),
        path: id,
        modeId: "project",
        slots: [],
        ...(id === "inspect"
          ? { parentId: "desk", resource: { kinds: [{ kind: "resource-kind" as const, id: "workspace" }] } }
          : {}),
        main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one" },
      });
    selectDashboardProject(w, { id: projectId, name: "Navigation" });
    w.pageLocations.boot(projectId);
    const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
    const previous = runtime.__PSTDIO_CONFIG__;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const { resources } = (await request.json()) as { resources: { id: string }[] };
        if (resources[0]?.id === "one") {
          entered.resolve();
          await release.promise;
        }
        return Response.json(
          resources.map((resource) => ({ resource, target: { kind: "page", page: page("inspect"), resource } })),
        );
      },
    });
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
    const first = openDashboardResource(w as WorkbenchModuleContext, {
      type: "workspace",
      extensionId: "pstdio",
      id: "one",
    });
    try {
      await entered.promise;
      if (transition === "newer opening") {
        await openDashboardResource(w as WorkbenchModuleContext, {
          type: "workspace",
          extensionId: "pstdio",
          id: "two",
        });
      } else if (transition === "explicit round trip") {
        w.pageLocations.navigate({ kind: "page", page: page("alternate") });
        w.pageLocations.navigate({ kind: "page", page: page("desk") });
      } else if (transition === "project round trip") {
        selectDashboardProject(w, { id: "another", name: "Another" });
        selectDashboardProject(w, { id: projectId, name: "Navigation" });
      } else if (transition === "unavailable default" || transition === "already unavailable default") {
        configured = undefined;
        await w.commands.executeCommand("workbench.page.openDefault");
        expect(w.pages.store.getState().location).toBeUndefined();
      } else w.pageLocations.replay(structuredClone(w.pages.store.getState().location!));
      release.resolve();
      await first;
      if (transition === "metadata replay") expect(w.pages.store.getState().location?.resource?.id).toBe("one");
      else if (transition === "newer opening") expect(w.pages.store.getState().location?.resource?.id).toBe("two");
      else if (transition === "unavailable default" || transition === "already unavailable default")
        expect(w.pages.store.getState().location).toBeUndefined();
      else expect(w.pages.store.getState().location?.page).toEqual(page("desk"));
    } finally {
      release.resolve();
      await first;
      w.dispose();
      runtime.__PSTDIO_CONFIG__ = previous;
      await server.stop(true);
    }
  });
}
