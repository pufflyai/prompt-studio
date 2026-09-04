import type { NavigationTargetPage, PageLocation, PageRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistry, WorkbenchPageRuntimeState } from "../../registries/pages/page-registry";
import type { WorkbenchStore } from "../../shared/store/workbench-store";

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

export interface WorkbenchPageLocationPersistence {
  load(projectId: string): PageLocation | undefined;
  save(projectId: string, location: PageLocation): void;
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
  persistence: WorkbenchPageLocationPersistence;
  startPage: PageRef;
  contextualizeTarget?(target: NavigationTargetPage): NavigationTargetPage;
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
  closePlacement(identity: PlacementIdentity): WorkbenchPageNavigationResult;
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
