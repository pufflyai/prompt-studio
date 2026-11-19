import { viewDataEvents } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionRuntime } from "./types/runtime";
import { refreshEventIds } from "./workbench/metadata/workbench-extension-metadata-normalizers";

// Core owns the legacy session identity. Only its built-in Sessions delegate may attest to its reads.
const sessions = {
  extensionId: "pstdio",
  type: "session",
  provider: "pstdio.session-browser",
  heads: "change-heads",
  read: "read-change",
  refreshEvents: [viewDataEvents.sessionsChanged.id],
};

export const resourceChangeProviders = (runtime: ExtensionRuntime) => {
  const commands = new Set(runtime.commands.map((c) => c.id));
  const kinds = runtime.resourceKinds.flatMap((k) => {
    const changes = k.contribution.changes;
    if (!changes || [changes.heads, changes.read].some((ref) => ref.extensionId && ref.extensionId !== k.extensionId))
      return [];
    return [
      {
        extensionId: k.extensionId,
        type: k.localId,
        provider: k.extensionId,
        heads: changes.heads.id,
        read: changes.read.id,
        refreshEvents: refreshEventIds(changes.refreshEvents, k.extensionId) ?? [],
      },
    ];
  });
  return [...kinds, sessions].flatMap((k) => {
    const heads = `${k.provider}.command.${k.heads}`;
    const read = `${k.provider}.command.${k.read}`;
    return commands.has(heads) && commands.has(read) ? [{ ...k, heads, read }] : [];
  });
};
