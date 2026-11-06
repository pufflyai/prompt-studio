import type { StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import { createLogStreamSync } from "pstdio-sync/logs";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { RouteDeps } from "../../features/deps";
import type { SessionLogFiles } from "./log-files";

export const genericSessionLogName = (sessionId: string, writerId: string) =>
  JSON.stringify(["pstdio.personal-history", "session-log-v2", sessionId, writerId]);

/** Personal history uses the platform transport with its existing lazy local payload files. */
export const createPersonalLogStreams = (input: {
  service: RouteDeps["extensionStorageService"]["logs"];
  owner: StorageOwner;
  files: SessionLogFiles;
  namespace: string;
}) => {
  const open = async (sessionId: string, writerId: string, space: SyncSpace, relay: (id: string) => DocumentRelay) => {
    const store = await input.service.stream(
      input.owner,
      { name: "session", scope: sessionId, stream: writerId, writer: "device" },
      input.files.payloads(input.namespace, sessionId),
    );
    const documentId = await space.documentId(genericSessionLogName(sessionId, writerId));
    const remote = relay(documentId);
    let manifests: ReturnType<typeof input.service.manifests> | undefined;
    const sync = createLogStreamSync({
      space,
      documentId,
      relay: remote,
      store,
      canCompact: writerId === (await input.service.writerId()),
      manifestBlobs: async () => {
        if (!remote.manifestBlobs) throw new Error("Personal log manifest transport unavailable");
        manifests ??= input.service.manifests(input.owner, space, await remote.manifestBlobs());
        return manifests;
      },
    });
    return { store, sync };
  };
  return { open, writerId: input.service.writerId };
};
export type PersonalLogStreams = ReturnType<typeof createPersonalLogStreams>;
