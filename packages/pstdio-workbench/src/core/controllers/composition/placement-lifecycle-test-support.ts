import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
export const page = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
export const panel = { kind: "placement" as const, extensionId: "test", id: "shared" };
export const resource = (id: string) => ({ type: "file", id });
export const navigate = (id: string) => ({
  kind: "page" as const,
  page: page("workspace"),
  resource: { type: "workspace", id },
});
export const openFile = (id: string) => ({
  kind: "panel" as const,
  panel: { kind: "page-slot" as const, page: page("workspace"), id: "files" },
  resource: resource(id),
  open: "preview" as const,
});
export function harness(saved = new Map<string | undefined, WorkbenchLayout>()) {
  const w = createWorkbench({
    layoutPersistence: { getLayout: (s) => saved.get(s), setLayout: (l, s) => saved.set(s, l) },
    resolvePagePersistenceScope: ({ projectId, resource }) => ({ scope: `${projectId}/${resource?.id ?? "home"}` }),
  });
  w.modes.registerMode({ id: "edit", activate() {} });
  for (const id of ["empty", "editor"])
    w.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "workspace",
    ref: page("workspace"),
    path: "workspace",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "files",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "file" }],
            view: { kind: "view", id: "editor" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  w.modePlacements.registerPlacement({
    id: "shared",
    ref: panel,
    modeId: "edit",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file" }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
      },
    },
  });
  w.pageLocations.setProject("project");
  return w;
}
