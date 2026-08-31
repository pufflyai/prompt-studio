import type { PageLocation, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { Disposable } from "../../shared/disposable";
import type {
  WorkbenchPageOpenInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
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

export interface WorkbenchPageRegistryInternals<Value> {
  resources: WorkbenchPageResourceCodec;
  connectRuntime(apply: (state: WorkbenchPageRegistryStoreState<Value>) => void): Disposable;
  activateLocation(input: WorkbenchPageLocationCommitInput): void;
  activateMode(projectId: string, modeId: string): void;
  refreshModePlacements(): void;
  clearProject(projectId: string): void;
  resolveClosePlacement(identity: PlacementIdentity): WorkbenchPageCloseResolution;
}

const registryInternals = new WeakMap<object, WorkbenchPageRegistryInternals<unknown>>();

export const setWorkbenchPageRegistryInternals = <Value>(
  registry: WorkbenchPageRegistry<Value>,
  internals: WorkbenchPageRegistryInternals<Value>,
) => {
  registryInternals.set(registry, internals as WorkbenchPageRegistryInternals<unknown>);
};

export const getWorkbenchPageRegistryInternals = <Value>(registry: WorkbenchPageRegistry<Value>) => {
  const internals = registryInternals.get(registry) as WorkbenchPageRegistryInternals<Value> | undefined;
  if (!internals) throw new Error("Workbench page registry internals are unavailable");
  return internals;
};
