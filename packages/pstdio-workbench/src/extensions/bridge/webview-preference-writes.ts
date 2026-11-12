import type { WorkbenchCore } from "../../core";
import { createPreferenceWrites } from "../../core/registries/preferences/preference-writes";
import { isWorkbenchRetiring, registerWorkbenchRequiredWork } from "../../core/workbench-required-work";

const owners = new WeakMap<WorkbenchCore, ReturnType<typeof createPreferenceWrites>>();
export const persistWorkbenchWebviewPreference = (
  core: WorkbenchCore,
  identity: unknown,
  write: () => void | Promise<void>,
) => {
  if (isWorkbenchRetiring(core)) throw new Error("Workbench is closed");
  let owner = owners.get(core);
  if (!owner) {
    owner = createPreferenceWrites();
    owners.set(core, owner);
    const captured = owner;
    registerWorkbenchRequiredWork(core, () => captured.close());
  }
  return owner.write(JSON.stringify(identity), write, () => {});
};
