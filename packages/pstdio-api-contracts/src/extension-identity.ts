import type { NavigationTarget } from "./extension-kernel/types/navigation-target";

// Historical facts belong to the host, never to an extension's manifest or a project setting.
interface ExtensionOwnerName {
  publisher: string;
  name: string;
}
export interface ExtensionIdentityRename {
  from: ExtensionOwnerName;
  to: ExtensionOwnerName;
}

export const extensionIdentityRenames: readonly ExtensionIdentityRename[] = [
  "artifacts",
  "base-themes",
  "cloud",
  "home",
  "notes",
  "onboarding",
  "performance",
  "planner",
  "reports",
  "session-browser",
  "skills",
  "workspaces",
  "dev",
].map((name) => ({ from: { publisher: "pstdio", name: `pstdio-${name}` }, to: { publisher: "pstdio", name } }));

const ownerId = (owner: ExtensionOwnerName) => `${owner.publisher}.${owner.name}`;
export const validateExtensionIdentityRenames = (renames: readonly ExtensionIdentityRename[]) => {
  const sources = new Set<string>();
  const targets = new Set<string>();
  for (const { from, to } of renames) {
    const source = ownerId(from);
    const target = ownerId(to);
    if (from.publisher !== to.publisher || source === target || sources.has(source) || targets.has(target))
      throw new Error(`Invalid historical extension rename: ${source} → ${target}`);
    sources.add(source);
    targets.add(target);
  }
  if ([...sources].some((source) => targets.has(source))) throw new Error("Extension rename chains are not supported");
};
validateExtensionIdentityRenames(extensionIdentityRenames);

const bySource = new Map(extensionIdentityRenames.map((rename) => [ownerId(rename.from), rename]));
const byTarget = new Map(extensionIdentityRenames.map((rename) => [ownerId(rename.to), rename]));
export const canonicalExtensionId = (id: string) => {
  const rename = bySource.get(id);
  return rename ? ownerId(rename.to) : id;
};
export const historicalExtensionId = (id: string) => {
  const rename = byTarget.get(id);
  return rename ? ownerId(rename.from) : id;
};
export const canonicalInstallName = (name: string) => {
  const rename = bySource.get(name) ?? byTarget.get(name) ?? extensionIdentityRenames.find((r) => r.from.name === name);
  return rename?.to.name ?? name;
};

export const matchesExtensionInstallName = (candidate: { extensionId: string; installName: string }, query: string) => {
  if (candidate.installName === query || candidate.extensionId === query) return true;
  const rename = byTarget.get(canonicalExtensionId(candidate.extensionId));
  return !!rename && [rename.from.name, ownerId(rename.from), rename.to.name, ownerId(rename.to)].includes(query);
};
export const canonicalOwner = <T extends { extensionId: string }>(owner: T): T => {
  const extensionId = canonicalExtensionId(owner.extensionId);
  return extensionId === owner.extensionId ? owner : { ...owner, extensionId };
};

const noteVerbs = new Set(["notes.create", "notes.rename", "notes.delete"]);
export const canonicalCliPath = (extensionId: string, localId: string, path: string[]) =>
  canonicalExtensionId(extensionId) === "pstdio.notes" && noteVerbs.has(localId) ? [localId.slice(6)] : path;

export const historicalCliPaths = (extensionId: string, localId: string, path: string[]) => {
  const rename = byTarget.get(extensionId);
  if (!rename) return [];
  const previousPath = extensionId === "pstdio.notes" && noteVerbs.has(localId) ? localId.split(".") : path;
  return [
    [ownerId(rename.from), ...previousPath],
    [rename.from.name, ...previousPath],
    ...(previousPath.join(" ") === path.join(" ") ? [] : [[extensionId, ...previousPath]]),
  ];
};

/** Only a structured contribution can allocate an alias. Runtime IDs remain opaque to callers. */
export const historicalContributionId = (ref: { extensionId: string; kind: string; id: string }) => {
  const owner = historicalExtensionId(ref.extensionId);
  return owner === ref.extensionId ? undefined : `${owner}.${ref.kind}.${ref.id}`;
};

export const canonicalStoragePath = (path: string) => {
  for (const { from, to } of extensionIdentityRenames) {
    const root = `.pstdio/extension-storage/${ownerId(from)}`;
    if (path === root || path.startsWith(`${root}/`))
      return `.pstdio/extension-storage/${ownerId(to)}${path.slice(root.length)}`;
  }
  return path;
};

/** An allocated path can participate in a durable document/projection identity. Keep that identity stable. */
export const historicalStoragePath = (path: string) => {
  for (const { from, to } of extensionIdentityRenames) {
    const root = `.pstdio/extension-storage/${ownerId(to)}`;
    if (path === root || path.startsWith(`${root}/`))
      return `.pstdio/extension-storage/${ownerId(from)}${path.slice(root.length)}`;
  }
  return path;
};

export const renamedStoragePathOwner = (path: string) => {
  const canonical = canonicalStoragePath(path);
  for (const { to } of extensionIdentityRenames) {
    const id = ownerId(to);
    const root = `.pstdio/extension-storage/${id}`;
    if (canonical === root || canonical.startsWith(`${root}/`)) return id;
  }
  return undefined;
};

const ownedRef = <T extends { extensionId?: string }>(ref: T): T =>
  ref.extensionId ? { ...ref, extensionId: canonicalExtensionId(ref.extensionId) } : ref;

/** Decode typed navigation owners without touching resource IDs, params, hrefs or content. */
export const canonicalNavigationOwners = (target: NavigationTarget): NavigationTarget => {
  if (target.kind === "href") return target;
  if (target.kind === "command")
    return { ...target, target: { ...target.target, command: ownedRef(target.target.command) } };
  if (target.kind === "compound")
    return { ...target, targets: target.targets.map((item) => canonicalNavigationOwners(item) as typeof item) };
  if (target.kind === "page")
    return {
      ...target,
      page: ownedRef(target.page),
      resource: target.resource && ownedRef(target.resource),
      parent: target.parent && (canonicalNavigationOwners(target.parent) as typeof target.parent),
    };
  if (target.kind === "dialog")
    return { ...target, page: ownedRef(target.page), resource: target.resource && ownedRef(target.resource) };
  if (target.kind === "viewer")
    return {
      ...target,
      page: target.page && ownedRef(target.page),
      resource: ownedRef(target.resource),
      from: target.from && ownedRef(target.from),
    };
  return {
    ...target,
    resource: target.resource && ownedRef(target.resource),
    panel:
      target.panel.kind === "page-slot"
        ? { ...target.panel, page: ownedRef(target.panel.page) }
        : ownedRef(target.panel),
  };
};

export const extensionTransportName = (extensionId: string, ...parts: string[]) =>
  JSON.stringify([historicalExtensionId(extensionId), ...parts]);
