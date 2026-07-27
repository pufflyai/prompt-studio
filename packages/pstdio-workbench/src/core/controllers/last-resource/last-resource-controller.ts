import type { ResourceRef } from "../../registries/resources/resource-registry";

export interface LastResourcePersistenceAdapter {
  getLastResource(): ResourceRef | undefined;
  setLastResource(resource: ResourceRef | undefined): void;
}

export interface WorkbenchLastResourceController {
  get(): ResourceRef | undefined;
  set(resource: ResourceRef | undefined): void;
  // Replays the persisted resource through the registered presenters. Returns
  // `true` when the saved resource opened successfully — apps use that signal
  // to decide whether to fall back to a default landing view.
  restore(): Promise<boolean>;
}

export interface CreateWorkbenchLastResourceControllerInput {
  persistence?: LastResourcePersistenceAdapter;
  openResource(resource: ResourceRef): Promise<unknown>;
}

export const createWorkbenchLastResourceController = (
  input: CreateWorkbenchLastResourceControllerInput,
): WorkbenchLastResourceController => {
  const get = () => input.persistence?.getLastResource();
  const set = (resource: ResourceRef | undefined) => input.persistence?.setLastResource(resource);

  const restore = async () => {
    const saved = get();
    if (!saved) return false;
    try {
      await input.openResource(saved);
      return true;
    } catch {
      // Saved resource is no longer openable (kind unregistered, provider
      // removed, …); let the caller fall back to its default.
      return false;
    }
  };

  return { get, set, restore };
};
