import type { DynamicModuleDefinition } from "../data";
import { assistantModuleId, diagnosticsModuleId, explorerModuleId } from "../data";
import { createAssistantModule } from "./assistant-module";
import { createDiagnosticsModule } from "./diagnostics-module";
import { createExplorerModule } from "./explorer-module";

export const dynamicModuleDefinitions: DynamicModuleDefinition[] = [
  { id: explorerModuleId, label: "Explorer", icon: "FolderTree", createModule: createExplorerModule },
  { id: diagnosticsModuleId, label: "Diagnostics", icon: "ListChecks", createModule: createDiagnosticsModule },
  { id: assistantModuleId, label: "Assistant", icon: "Bot", createModule: createAssistantModule },
];
