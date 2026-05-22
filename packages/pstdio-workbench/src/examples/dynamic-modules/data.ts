import type { Disposable, ResourceRef, WorkbenchModuleContribution } from "../../core";

export const hostModuleId = "dynamic-modules.host";
export const topControlsWidgetId = "dynamic-modules.controls";
export const inventoryWidgetId = "dynamic-modules.inventory";
export const openInventoryCommandId = "dynamic-modules.openInventory";

export const explorerModuleId = "dynamic-modules.explorer";
export const explorerWidgetId = "dynamic-modules.explorer.preview";
export const explorerTreeId = "dynamic-modules.explorer.tree";
export const explorerCommandId = "dynamic-modules.explorer.openReadme";
export const fileKind = "dynamic-module-file";

export const diagnosticsModuleId = "dynamic-modules.diagnostics";
export const diagnosticsWidgetId = "dynamic-modules.diagnostics.panel";
export const diagnosticsCommandId = "dynamic-modules.diagnostics.run";
export const diagnosticKind = "dynamic-module-diagnostic";

export const assistantModuleId = "dynamic-modules.assistant";
export const assistantWidgetId = "dynamic-modules.assistant.panel";
export const assistantCommandId = "dynamic-modules.assistant.open";

export const readmeResource: ResourceRef = {
  kind: fileKind,
  id: "readme.md",
  uri: "pstdio://dynamic-modules/files/readme.md",
  label: "README.md",
  icon: "FileText",
};

export const diagnosticResource: ResourceRef = {
  kind: diagnosticKind,
  id: "validate",
  uri: "pstdio://dynamic-modules/diagnostics/validate",
  label: "Validate",
  icon: "ListChecks",
};

export interface DynamicModuleDefinition {
  id: string;
  label: string;
  icon: string;
  createModule: () => WorkbenchModuleContribution;
}

export interface DynamicModuleController {
  getEnabledModuleIds(): string[];
  setEnabled(moduleId: string, enabled: boolean): void;
  subscribe(listener: () => void): Disposable;
}
