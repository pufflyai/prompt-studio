import type { NavigationTargetPanel, PageLocation, PlacementIdentity } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageOpenInput,
  WorkbenchPageRegistry,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";

export interface WorkbenchPageLocationCommitInput extends WorkbenchPageOpenInput {
  projectId: string;
  location: PageLocation;
  action: string;
  pageStates?: Readonly<Record<string, WorkbenchPageRuntimeState>>;
}

export type WorkbenchPageCloseResolution =
  | {
      kind: "stay";
      pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
      target: WorkbenchPageOpenInput;
      locationChanged: boolean;
    }
  | {
      kind: "parent";
      pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
      parentId: string;
    };

export interface WorkbenchPageRegistryInternals {
  resources: WorkbenchPageResourceCodec;
  activateLocation(input: WorkbenchPageLocationCommitInput): void;
  openPanel(target: NavigationTargetPanel): PlacementIdentity;
  clearProject(projectId: string): void;
  resolveClosePlacement(identity: PlacementIdentity): WorkbenchPageCloseResolution;
}

const registryInternals = new WeakMap<object, WorkbenchPageRegistryInternals>();

export const setWorkbenchPageRegistryInternals = <Value>(
  registry: WorkbenchPageRegistry<Value>,
  internals: WorkbenchPageRegistryInternals,
) => {
  registryInternals.set(registry, internals);
};

export const getWorkbenchPageRegistryInternals = <Value>(registry: WorkbenchPageRegistry<Value>) => {
  const internals = registryInternals.get(registry);
  if (!internals) throw new Error("Workbench page registry internals are unavailable");
  return internals;
};
