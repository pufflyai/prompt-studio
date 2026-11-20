import { withProjectExtensionChoices } from "../features/extensions/project-extension-choices";

const projectArguments = new Set([
  "enableInstalledSourceForProject",
  "attachRegisteredSourceForProject",
  "syncInstalledSourceForProject",
  "pruneProjectExtensionInstances",
  "uninstallProjectExtension",
]);
const instanceArguments = new Set(["setProjectExtensionEnabled", "removeProjectExtensionInstance"]);

/** Keep all source-selection writers ordered with lifecycle/publication operations. */
export const serializeExtensionChoices = <T extends object>(
  service: T,
  instanceProject: (id: string) => Promise<string | null>,
): T => {
  const wrap = (projectIds: string[], run: () => Promise<unknown>): Promise<unknown> => {
    const [projectId, ...rest] = projectIds;
    return projectId ? withProjectExtensionChoices(proxy, projectId, () => wrap(rest, run)) : run();
  };
  const proxy = new Proxy(service, {
    get(target, property, receiver) {
      const method = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || typeof method !== "function") return method;
      const run = (args: unknown[]) => Promise.resolve(Reflect.apply(method, target, args));
      if (projectArguments.has(property))
        return (input: { projectId: string }) => wrap([input.projectId], () => run([input]));
      if (property === "adoptDefaultSourceForProject")
        return (projectId: string, sourceId: string) => wrap([projectId], () => run([projectId, sourceId]));
      if (instanceArguments.has(property))
        return async (instanceId: string, ...rest: unknown[]) => {
          const projectId = await instanceProject(instanceId);
          return wrap(projectId ? [projectId] : [], () => run([instanceId, ...rest]));
        };
      if (property === "activatePublishedExtensions")
        return (inputs: Array<{ projectId: string }>) =>
          wrap([...new Set(inputs.map(({ projectId }) => projectId))].sort(), () => run([inputs]));
      return method;
    },
  });
  return proxy;
};
