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

export interface CreateWorkbenchPanelTargetControllerInput<Value> {
  registry: WorkbenchPageRegistry<Value>;
  reportDiagnostic?(diagnostic: WorkbenchPanelTargetDiagnostic): void;
}

export interface WorkbenchPanelTargetController {
  open(target: NavigationTargetPanel): WorkbenchPanelTargetResult;
}

export const createWorkbenchPanelTargetController = <Value>(
  input: CreateWorkbenchPanelTargetControllerInput<Value>,
): WorkbenchPanelTargetController => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);

  return {
    open(target) {
      try {
        return { ok: true, identity: internals.openPanel(target) };
      } catch (error) {
        const diagnostic: WorkbenchPanelTargetDiagnostic = {
          code: "panel-target-unresolved",
          message: error instanceof Error ? error.message : String(error),
        };
        input.reportDiagnostic?.(diagnostic);
        return { ok: false, diagnostic };
      }
    },
  };
};
