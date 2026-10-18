import type { RelatedResourceOpenings, ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchModuleContext } from "../../core";
import { registerRelatedResourcePreviews } from "./related-resource-previews";
import type { ResourceLinksService } from "./resource-links-types";

export const ref = (type: string, id: string) =>
  ({
    type,
    id,
    extensionId: "example",
    projectId: "project",
  }) satisfies ResourceRef;
export const opening = (id: string, region: "side" | "secondary" | "main" = "side") => ({
  resource: ref("document", id),
  autoOpen: true,
  region,
});
export const setup = (initial: RelatedResourceOpenings = [], options: Parameters<typeof createWorkbench>[0] = {}) => {
  let saved: import("../../core").PersistedWorkbenchPageLocation | undefined;
  const workbench = createWorkbench({
    initialSidePanelMode: "closed",
    pageLocationPersistence: {
      load: () => saved,
      save: (_projectId, value) => {
        saved = value;
      },
    },
    ...options,
  });
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
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
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
  const resolved: string[] = [];
  let reads = 0;
  const service: ResourceLinksService = {
    list: async () => ({ items: [{ source, target: ref("document", "implicit") }] }),
    resolve: async (resources) =>
      resources.map((resource) => {
        resolved.push(resource.id);
        return { resource, target: target(resource) };
      }),
    search: async () => [],
    add: async () => {},
    remove: async () => {},
    subscribe: () => () => {},
  };
  let resolveOpenings = async (_resource: ResourceRef, _signal: AbortSignal) => initial;
  const owner = workbench.resources.registerKind({
    kind: "document",
    label: "Document",
    extensionId: "example",
    relatedOpenings: (resource, signal) => {
      reads++;
      return resolveOpenings(resource, signal);
    },
  });
  const controller = registerRelatedResourcePreviews(workbench as WorkbenchModuleContext, {
    canonicalize: (resource) => resource,
    createService: () => service,
  });
  return {
    workbench,
    forgetSavedLocation: () => {
      saved = undefined;
    },
    source,
    controller,
    service,
    target,
    resolved,
    owner,
    reads: () => reads,
    setResolver: (resolver: typeof resolveOpenings) => {
      resolveOpenings = resolver;
    },
  };
};
