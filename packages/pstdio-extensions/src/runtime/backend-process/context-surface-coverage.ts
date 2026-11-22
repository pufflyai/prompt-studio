import { extensionContextSurface } from "./context-surface";
import { isUnsupportedContextMember } from "./service-surfaces";
import type { BackendSurface } from "./surface";

// Representative arguments for the synchronous factories the walk follows.
const factoryArgs: Record<string, unknown[]> = {
  collection: ["items"],
  scope: [{ type: "project" }],
  mount: ["key"],
  attachments: ["item"],
};

type Walk = { found: string[]; walked: Set<BackendSurface> };

const hasFunctions = (value: unknown) =>
  value !== null && typeof value === "object" && Object.values(value).some((entry) => typeof entry === "function");

const visitFunction = (
  owner: object,
  member: (...args: unknown[]) => unknown,
  described: BackendSurface | undefined,
  path: string[],
  state: Walk,
) => {
  if (!described) {
    state.found.push(path.join("."));
    return;
  }
  if (described.kind !== "factory" || state.walked.has(described.returns)) return;
  let created: unknown;
  try {
    created = member.apply(owner, factoryArgs[path.at(-1)!] ?? []);
  } catch {
    // A factory may refuse the representative arguments, such as an undeclared artifact mount.
    return;
  }
  state.walked.add(described.returns);
  walk(created, described.returns, path, state);
};

/** Every function a handler's ctx offers is either reachable from the worker or knowingly unsupported. */
const walk = (value: unknown, surface: BackendSurface | undefined, path: string[], state: Walk): void => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  for (const [name, member] of Object.entries(value)) {
    const memberPath = [...path, name];
    const described = surface?.kind === "object" ? surface.members[name] : undefined;
    if (isUnsupportedContextMember(memberPath.join("."))) continue;
    if (typeof member === "function") visitFunction(value, member, described, memberPath, state);
    else if (described?.kind === "object") walk(member, described, memberPath, state);
    else if (!described && hasFunctions(member)) state.found.push(memberPath.join("."));
  }
};

/** Paths of ctx functions that are neither in the process-mode surface nor knowingly unsupported. */
export const uncoveredContextFunctions = (context: { projectId: string }) => {
  const found: string[] = [];
  walk(context, extensionContextSurface(context.projectId), [], { found, walked: new Set() });
  return found;
};
