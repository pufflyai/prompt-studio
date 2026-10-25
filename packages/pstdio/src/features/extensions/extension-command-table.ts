import type { ExtensionCommandRecord } from "@pstdio/sdk/api";

export type ExtensionCommandCollision = { path: string; commands: ExtensionCommandRecord[] };
export type ExtensionCommandTable = {
  byPath: Map<string, ExtensionCommandRecord>;
  byNamespace: Map<string, ExtensionCommandRecord[]>;
  collisions: ExtensionCommandCollision[];
};
export const commandCliPaths = (command: ExtensionCommandRecord) => {
  const paths = [command.cliPath, ...(command.cliAliases ?? [])].filter((path): path is string => Boolean(path));
  if (command.cliPath?.startsWith(`${command.extensionId} `)) {
    paths.push(command.cliPath.slice(command.extensionId.indexOf(".") + 1));
  }
  return [...new Set(paths)];
};

export const buildExtensionCommandTable = (
  commands: ExtensionCommandRecord[],
  extensionIds = commands.map((command) => command.extensionId),
) => {
  const byNamespace = new Map<string, ExtensionCommandRecord[]>();
  const byPath = new Map<string, ExtensionCommandRecord>();
  const collisionsByPath = new Map<string, ExtensionCommandRecord[]>();
  const owners = new Map<string, Set<string>>();
  for (const id of extensionIds) {
    const name = id.split(".")[1]!;
    owners.set(name, new Set([...(owners.get(name) ?? []), id]));
  }
  for (const [name, providers] of owners) {
    if (providers.size > 1)
      collisionsByPath.set(
        name,
        commands.filter((command) => providers.has(command.extensionId)),
      );
  }
  const addPath = (path: string, command: ExtensionCommandRecord) => {
    const namespace = path.split(" ")[0]!;
    const providers = owners.get(namespace);
    if (providers && providers.size > 1 && path !== command.cliPath && !command.cliAliases?.includes(path)) {
      collisionsByPath.set(
        path,
        commands.filter((candidate) => providers.has(candidate.extensionId)),
      );
      byPath.delete(path);
      return;
    }
    const existing = byPath.get(path);
    if (existing) {
      collisionsByPath.set(path, [...(collisionsByPath.get(path) ?? [existing]), command]);
      byPath.delete(path);
    } else if (!collisionsByPath.has(path)) byPath.set(path, command);
  };
  for (const command of commands) {
    const paths = commandCliPaths(command);
    const scopes = paths.length ? paths.map((path) => path.split(" ")[0] ?? "") : [command.id.split(".")[0] ?? ""];
    for (const namespace of new Set(scopes)) {
      const group = byNamespace.get(namespace) ?? [];
      if (!group.includes(command)) group.push(command);
      byNamespace.set(namespace, group);
    }
    for (const path of paths) addPath(path, command);
  }
  return {
    byPath,
    byNamespace,
    collisions: [...collisionsByPath].map(([path, pathCommands]) => ({ path, commands: pathCommands })),
  };
};
