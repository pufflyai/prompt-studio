import type {
  CreateWorkbenchPageLocationControllerInput,
  WorkbenchPageLocationDiagnostic,
  WorkbenchPageNavigationResult,
} from "./page-location-controller";

export const reportPageLocationFailure = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  source: WorkbenchPageLocationDiagnostic["source"],
  error: unknown,
): WorkbenchPageNavigationResult => {
  const diagnostic: WorkbenchPageLocationDiagnostic = {
    code: "page-location-unresolved",
    source,
    message: error instanceof Error ? error.message : String(error),
  };
  input.reportDiagnostic?.(diagnostic);
  return { ok: false, diagnostic };
};
