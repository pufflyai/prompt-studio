import { createShellCore } from "../../core";
import { diagnosticsModuleId, explorerModuleId } from "./data";
import { createDynamicModuleController } from "./dynamic-module-controller";
import { dynamicModuleDefinitions } from "./modules/dynamic-module-definitions";
import { createDynamicModulesHostModule } from "./modules/host-module";

export const createDynamicModulesShell = () => {
  const shell = createShellCore();
  const controller = createDynamicModuleController(shell, dynamicModuleDefinitions);
  shell.registerModule(createDynamicModulesHostModule(controller, dynamicModuleDefinitions));
  controller.setEnabled(explorerModuleId, true);
  controller.setEnabled(diagnosticsModuleId, true);
  return shell;
};
