import type { NavigationExecutionContext } from "../../registries/navigation/navigation-registry";
import type { WorkbenchShellController } from "./shell-controller";

const scopes = new WeakMap<WorkbenchShellController, NavigationExecutionContext>();

export const registerShellNavigationScope = (shell: WorkbenchShellController, scope: NavigationExecutionContext) => {
  scopes.set(shell, scope);
};

export const getShellNavigationScope = (shell: WorkbenchShellController) => scopes.get(shell)!;
