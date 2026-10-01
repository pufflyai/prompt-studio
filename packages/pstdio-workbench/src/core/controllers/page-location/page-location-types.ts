import type {
  NavigationTargetPage,
  PageLocation,
  PageRef,
  PlacementIdentity,
  ResourceRef,
} from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type { WorkbenchPageRegistry, WorkbenchPageRuntimeState } from "../../registries/pages/page-registry";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { NavigationLevelModes } from "./navigation-level";

export interface WorkbenchPageBrowserEntry {
  url: string;
  state?: unknown;
}

export interface WorkbenchPageLocationBrowser {
  current(): WorkbenchPageBrowserEntry;
  push(entry: WorkbenchPageBrowserEntry): void;
  replace(entry: WorkbenchPageBrowserEntry): void;
  back(): void;
  forward(): void;
  onPopState(listener: (entry: WorkbenchPageBrowserEntry) => void): { dispose(): void };
}

export interface PersistedWorkbenchPageLocation {
  location: PageLocation;
  // The last location outside every Sidenav level. Users return here when a level hides the project rows.
  rootLevel?: PageLocation;
}

export interface WorkbenchPageLocationPersistence {
  load(projectId: string): PersistedWorkbenchPageLocation | undefined;
  save(projectId: string, persisted: PersistedWorkbenchPageLocation): void;
}

export interface WorkbenchPageLocationDiagnostic {
  code: "page-location-unresolved";
  source: "boot" | "history" | "navigation" | "project-switch";
  message: string;
}

export interface WorkbenchPageHistoryState {
  kind: "pstdio.page-location";
  index: number;
  projectId: string;
  routeKey: string;
  location: PageLocation;
}

export type WorkbenchPageNavigationResult =
  | { ok: true; location: PageLocation }
  | { ok: false; diagnostic: WorkbenchPageLocationDiagnostic };

export interface CreateWorkbenchPageLocationControllerInput<Value> {
  registry: WorkbenchPageRegistry<Value>;
  browser: WorkbenchPageLocationBrowser;
  navigationTrees: NavigationTreeRegistry;
  modes: NavigationLevelModes;
  persistence: WorkbenchPageLocationPersistence;
  startPage: PageRef;
  reportDiagnostic?(diagnostic: WorkbenchPageLocationDiagnostic): void;
}

export interface WorkbenchPageLocationController {
  historyStore: WorkbenchStore<WorkbenchPageLocationHistoryState>;
  setProject(projectId: string): void;
  clearProject(): void;
  isCurrentProjectUrl(projectId: string): boolean;
  hasCurrentPageUrl(projectId: string): boolean;
  boot(projectId: string): WorkbenchPageNavigationResult;
  switchProject(projectId: string): WorkbenchPageNavigationResult;
  navigate(target: NavigationTargetPage): WorkbenchPageNavigationResult;
  replay(location: PageLocation): WorkbenchPageNavigationResult;
  navigateToParent(): WorkbenchPageNavigationResult;
  /** Opens the last location outside every Sidenav level, or the start page when there is none. */
  navigateToRootLevel(): WorkbenchPageNavigationResult;
  closePlacement(identity: PlacementIdentity): WorkbenchPageNavigationResult;
  removeResource(resource: ResourceRef, retained: readonly PlacementIdentity[]): void;
  goBack(): void;
  goForward(): void;
  dispose(): void;
}

export interface WorkbenchPageLocationHistoryState {
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ResolvedPageLocation {
  pageId: string;
  location: PageLocation;
  open?: NavigationTargetPage["open"];
  pageStates?: Readonly<Record<string, WorkbenchPageRuntimeState>>;
}
