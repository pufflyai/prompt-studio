import type { NavigationTargetPanel, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistry } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";

export interface WorkbenchPanelTargetDiagnostic {
  code: "panel-target-unresolved";
  message: string;
}

export type WorkbenchPanelTargetResult =
  | { ok: true; identity: PlacementIdentity }
  | { ok: false; diagnostic: WorkbenchPanelTargetDiagnostic };

export type WorkbenchPanelTargetBatchResult =
  | { ok: true; identities: readonly PlacementIdentity[] }
  | { ok: false; diagnostic: WorkbenchPanelTargetDiagnostic };

export interface CreateWorkbenchPanelTargetControllerInput<Value> {
  registry: WorkbenchPageRegistry<Value>;
  reportDiagnostic?(diagnostic: WorkbenchPanelTargetDiagnostic): void;
}

export interface WorkbenchPanelTargetController {
  open(target: NavigationTargetPanel): WorkbenchPanelTargetResult;
  openMany(targets: readonly NavigationTargetPanel[]): WorkbenchPanelTargetBatchResult;
}

export const createWorkbenchPanelTargetController = <Value>(
  input: CreateWorkbenchPanelTargetControllerInput<Value>,
): WorkbenchPanelTargetController => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);

  const fail = (error: unknown) => {
    const diagnostic: WorkbenchPanelTargetDiagnostic = {
      code: "panel-target-unresolved",
      message: error instanceof Error ? error.message : String(error),
    };
    input.reportDiagnostic?.(diagnostic);
    return { ok: false, diagnostic } as const;
  };

  const openMany = (targets: readonly NavigationTargetPanel[]): WorkbenchPanelTargetBatchResult => {
    try {
      return { ok: true, identities: internals.openPanels(targets) };
    } catch (error) {
      return fail(error);
    }
  };

  return {
    open(target) {
      try {
        return { ok: true, identity: internals.openPanel(target) };
      } catch (error) {
        return fail(error);
      }
    },

    openMany(targets) {
      return openMany(targets);
    },
  };
};
