import type { NavigationTargetPage, PageRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import { createNavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import {
  createWorkbenchPageLocationController,
  type PersistedWorkbenchPageLocation,
  type WorkbenchPageBrowserEntry,
  type WorkbenchPageLocationBrowser,
  type WorkbenchPageLocationPersistence,
} from "./page-location-controller";
export const pageRef = (extensionId: string, id: string): PageRef => ({ extensionId, kind: "page", id });
export const startRef = pageRef("pstdio", "start");
export const ticketsRef = pageRef("acme.planner", "tickets");
export const ticketRef = pageRef("acme.planner", "ticket");
export const workspaceRef = pageRef("pstdio", "workspaces");
export const sessionsRef = pageRef("pstdio", "sessions");
export const sessionRef = pageRef("pstdio", "session");
export const notesRef = pageRef("acme.notes", "notes");
export const labRef = pageRef("acme.lab", "lab");
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
  region: identity.kind === "shell" ? "sidenav" : "side",
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
    resolvePagePlacement: (input: WorkbenchPagePlacementInput) =>
      `${input.pageId}:${input.viewId}:${input.resource?.id ?? "default"}`,
    resources,
    valuesEqual: (left, right) => left === right,
  });
  registry.registerPage({
    id: "start",
    ref: startRef,
    title: "Start",
    path: "",
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "start",
      },
      cardinality: "one",
    },
    slots: [],
  });
  registry.registerPage({
    id: "tickets",
    ref: ticketsRef,
    title: "Tickets",
    path: "tickets",
    modeId: "project",
    parentId: "start",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "tickets",
      },
      cardinality: "one",
    },
    slots: [],
  });
  registry.registerPage({
    id: "ticket",
    ref: ticketRef,
    title: "Ticket",
    path: "ticket",
    modeId: "project",
    parentId: "tickets",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "ticket",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "ticket",
      },
      cardinality: "many",
    },
    slots: [],
  });
  registry.registerPage({
    id: "workspaces",
    ref: workspaceRef,
    title: "Workspaces",
    path: "workspaces",
    modeId: "project",
    parentId: "start",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "workspace",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "workspace",
      },
      cardinality: "many",
    },
    slots: [],
  });
  registry.registerPage({
    id: "sessions",
    ref: sessionsRef,
    title: "Sessions",
    path: "sessions",
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "sessions",
      },
      cardinality: "one",
    },
    slots: [],
  });
  registry.registerPage({
    id: "session",
    ref: sessionRef,
    title: "Session",
    path: "session",
    modeId: "project",
    parentId: "sessions",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "session",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "session",
      },
      cardinality: "many",
    },
    slots: [],
  });
  registry.registerPage({
    id: "notes",
    ref: notesRef,
    title: "Notes",
    path: "notes",
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "notes",
      },
      cardinality: "one",
    },
    slots: [],
  });
  // The Lab mode hides the project Sidenav, so its page leaves the project navigation.
  registry.registerPage({
    id: "lab",
    ref: labRef,
    title: "Lab",
    path: "lab",
    modeId: "lab",
    main: { kind: "view", view: { kind: "view", id: "lab" }, cardinality: "one" },
    slots: [],
  });
  return registry;
};
const modes = {
  getMode: (id: string) => (id === "lab" ? { chrome: { sidenav: false as const } } : undefined),
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
    back: () => undefined,
    forward: () => undefined,
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
  const values = new Map<string, PersistedWorkbenchPageLocation>();
  const persistence: WorkbenchPageLocationPersistence = {
    load: (projectId) => values.get(projectId),
    save: (projectId, persisted) => values.set(projectId, persisted),
  };
  return { persistence, values };
};
// A page that owns a content navigation tree starts a Sidenav level.
const openLevel = (navigationTrees: ReturnType<typeof createNavigationTreeRegistry>, pageId: string) =>
  navigationTrees.registerContribution({
    id: `${pageId}.content`,
    owner: { kind: "page", id: pageId, extensionId: "pstdio" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    slot: "content",
    getSections: () => [],
  });

export const createPageLocationHarness = (url = "/projects/p1") => {
  const registry = createRegistry();
  const navigationTrees = createNavigationTreeRegistry();
  const browser = createBrowser(url);
  const persistence = createPersistence();
  const diagnostics: string[] = [];
  const controller = createWorkbenchPageLocationController({
    registry,
    browser: browser.browser,
    navigationTrees,
    modes,
    persistence: persistence.persistence,
    startPage: startRef,
    reportDiagnostic: (diagnostic) => diagnostics.push(diagnostic.message),
  });
  return {
    registry,
    navigationTrees,
    browser,
    persistence,
    diagnostics,
    controller,
    openLevel: (pageId: string) => openLevel(navigationTrees, pageId),
  };
};
export const ticketTarget = (id = "ticket:ps-326"): NavigationTargetPage => ({
  kind: "page",
  page: ticketRef,
  resource: { type: "ticket", id },
});
