import type { Disposable } from "../../shared/disposable";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCoreContributionContext } from "../../workbench-core";
import type {
  WorkbenchLayout,
  WorkbenchPanelRegion,
  WorkbenchRegion,
  WorkbenchRegionSettings,
} from "../layout/layout-model";
import type { ResourceRef } from "../resources/resource-registry";

export type WorkbenchModeActivationContext = WorkbenchCoreContributionContext;

export type WorkbenchModeActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModeAddablePanel {
  panelId: string;
  region: WorkbenchPanelRegion;
  allowedRegions?: readonly WorkbenchRegion[];
  pinned?: boolean;
}

export interface WorkbenchModeAddablePanelContext {
  layout: WorkbenchLayout;
  resource?: ResourceRef;
}

export interface WorkbenchModeContribution {
  id: string;
  label?: string;
  defaultTheme?: string;
  floatingPanels?: "visible" | "hidden";
  chrome?: Partial<Record<"nav" | "sidenav" | "activity" | "status", string | false>>;
  panels?: readonly WorkbenchPanelRegion[];
  /** Region-level layout policy while this mode is active. */
  regionSettings?: Partial<Record<WorkbenchRegion, WorkbenchRegionSettings>>;
  // Resource kinds this mode accepts. The atomic navigator validates targets
  // against this list; a mode without kinds navigates with a cleared resource.
  resourceKinds?: readonly string[];
  // Fallback resource when the mode is entered without a compatible resource.
  defaultResource?: ResourceRef | (() => Promise<ResourceRef | undefined> | ResourceRef | undefined);
  // Returns optional composition panels that are closed in the current context.
  listAddablePanels?(context: WorkbenchModeAddablePanelContext): readonly WorkbenchModeAddablePanel[];
  // Registers the mode's contributions once for the lifetime of the mode.
  activate(ctx: WorkbenchModeActivationContext): WorkbenchModeActivationResult;
  // Seeds default placements only when the persistence scope has no layout yet.
  seed?(ctx: WorkbenchModeActivationContext): void;
  // Activates non-layout behavior while the mode is current.
  enter?(ctx: WorkbenchModeActivationContext): WorkbenchModeActivationResult;
  // Repairs required layout structure whenever the mode-scope context activates:
  // first activation, reselecting the active mode, and persistence-scope changes.
  // Reconciliation must not reset valid optional user state.
  reconcile?(ctx: WorkbenchModeActivationContext): void;
}

export type WorkbenchModeChangeListener = () => void;

export interface WorkbenchModeStoreState {
  modes: Record<string, WorkbenchModeContribution>;
  activeModeId: string | undefined;
}

export interface WorkbenchModeRegistry {
  store: WorkbenchStore<WorkbenchModeStoreState>;
  dispose(): void;
  registerMode(mode: WorkbenchModeContribution): Disposable;
  getMode(id: string): WorkbenchModeContribution | undefined;
  listModes(): WorkbenchModeContribution[];
  getActiveModeId(): string | undefined;
  isTransitioning(): boolean;
  setActiveMode(id: string | undefined, input?: { deferSeed?: boolean }): void;
  seedActiveMode(): void;
  onDidChangeActive(listener: WorkbenchModeChangeListener): Disposable;
}

export interface CreateWorkbenchModeRegistryInput {
  establishLocation?(instanceId: string): void;
  layout: Pick<WorkbenchCoreContributionContext["layout"], "onDidChangePersistenceScope">;
  resolveContext(): WorkbenchModeActivationContext;
}
