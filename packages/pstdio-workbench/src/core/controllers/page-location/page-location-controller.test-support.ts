import type { NavigationTargetPage, PageLocation, PageRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import {
  createWorkbenchPageLocationController,
  type WorkbenchPageBrowserEntry,
  type WorkbenchPageLocationBrowser,
  type WorkbenchPageLocationPersistence,
} from "./page-location-controller";

export const pageRef = (extensionId: string, id: string): PageRef => ({ extensionId, kind: "page", id });
export const startRef = pageRef("pstdio", "start");
export const ticketsRef = pageRef("acme.planner", "tickets");
export const ticketRef = pageRef("acme.planner", "ticket");
export const workspaceRef = pageRef("pstdio", "workspaces");

const resources: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource, id: resource.id.replace(/^ticket:/, "").toUpperCase() }),
  toUri: (resource) => `pstdio://${resource.type}/${encodeURIComponent(resource.id)}`,
  fromUri: (uri) => {
    try {
      const parsed = new URL(uri);
      const id = parsed.pathname.slice(1);
      if (parsed.protocol !== "pstdio:" || !parsed.hostname || !id) return undefined;
      return { type: parsed.hostname, id: decodeURIComponent(id) };
    } catch {
      return undefined;
    }
  },
};

const placement = (identity: PlacementIdentity, value: string): ResolvedOwnedPlacement<string> => ({
  identity,
  region: identity.kind === "shell" ? "sidenav-header" : "side",
  order: 0,
  value,
});

const createRegistry = () => {
  const registry = createWorkbenchPageRegistry({
    resolveShellPlacements: () => [
      placement({ kind: "shell", placementId: "project-header", instanceKey: "default" }, "header"),
    ],
    resolveModePlacements: (modeId) => [
      placement({ kind: "mode", modeId, placementId: "shared", instanceKey: "default" }, `mode:${modeId}`),
    ],
    resolveModePanelTarget: () => {
      throw new Error("No mode panels are registered in this test");
    },
    resolvePagePlacement: (input: WorkbenchPagePlacementInput) =>
      `${input.pageId}:${input.viewId}:${input.resource?.id ?? "default"}`,
    resources,
    valuesEqual: (left, right) => left === right,
  });
  registry.registerPage({
    id: "start",
    ref: startRef,
    path: "",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start" }],
  });
  registry.registerPage({
    id: "tickets",
    ref: ticketsRef,
    path: "tickets",
    modeId: "project",
    parentId: "start",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets" }],
  });
  registry.registerPage({
    id: "ticket",
    ref: ticketRef,
    path: "ticket",
    modeId: "project",
    parentId: "tickets",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        cardinality: "many",
        closable: true,
        binding: { resourceKind: "ticket", viewId: "ticket" },
      },
    ],
  });
  registry.registerPage({
    id: "workspaces",
    ref: workspaceRef,
    path: "workspaces",
    modeId: "project",
    parentId: "start",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        cardinality: "many",
        closable: true,
        binding: { resourceKind: "workspace", viewId: "workspace" },
      },
    ],
  });
  return registry;
};

const createBrowser = (initialUrl: string) => {
  let current: WorkbenchPageBrowserEntry = { url: initialUrl };
  const pushes: WorkbenchPageBrowserEntry[] = [];
  const replacements: WorkbenchPageBrowserEntry[] = [];
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  const browser: WorkbenchPageLocationBrowser = {
    current: () => current,
    push: (entry) => {
      current = entry;
      pushes.push(entry);
    },
    replace: (entry) => {
      current = entry;
      replacements.push(entry);
    },
    onPopState: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
  return {
    browser,
    pushes,
    replacements,
    current: () => current,
    pop(entry: WorkbenchPageBrowserEntry) {
      current = entry;
      for (const listener of listeners) listener(entry);
    },
  };
};

const createPersistence = () => {
  const values = new Map<string, PageLocation>();
  const persistence: WorkbenchPageLocationPersistence = {
    load: (projectId) => values.get(projectId),
    save: (projectId, location) => values.set(projectId, location),
  };
  return { persistence, values };
};

export const createPageLocationHarness = (url = "/projects/p1") => {
  const registry = createRegistry();
  const browser = createBrowser(url);
  const persistence = createPersistence();
  const diagnostics: string[] = [];
  const controller = createWorkbenchPageLocationController({
    registry,
    browser: browser.browser,
    persistence: persistence.persistence,
    startPage: startRef,
    reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic.message),
  });
  return { registry, browser, persistence, diagnostics, controller };
};

export const ticketTarget = (id = "ticket:ps-326"): NavigationTargetPage => ({
  kind: "page",
  page: ticketRef,
  resource: { type: "ticket", id },
});
