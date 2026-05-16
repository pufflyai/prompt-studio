import { createWorkbenchCore } from "../../core";
import { diagnosticsModuleId, explorerModuleId } from "./data";
import { createDynamicModuleController } from "./dynamic-module-controller";
import { dynamicModuleDefinitions } from "./modules/dynamic-module-definitions";
import { createDynamicModulesHostModule } from "./modules/host-module";

export const createDynamicModulesWorkbench = () => {
  const workbench = createWorkbenchCore();
  const controller = createDynamicModuleController(workbench, dynamicModuleDefinitions);
  workbench.registerModule(createDynamicModulesHostModule(controller, dynamicModuleDefinitions));
  controller.setEnabled(explorerModuleId, true);
  controller.setEnabled(diagnosticsModuleId, true);
  return workbench;
};
