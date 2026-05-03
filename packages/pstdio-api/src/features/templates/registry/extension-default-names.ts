import type { RouteDeps } from "../../deps";

const parseNamespacedName = (name: string) => {
  const dot = name.indexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return { namespace: name.slice(0, dot), key: name.slice(dot + 1) };
};

export const isExtensionDefaultName = async (deps: RouteDeps, name: string) => {
  const parsed = parseNamespacedName(name);
  if (!parsed) return false;
  const checkResult = await deps.extensionService.check();
  return checkResult.runtime.templates.some(
    (entry) => entry.namespace === parsed.namespace && entry.localId === parsed.key,
  );
};
