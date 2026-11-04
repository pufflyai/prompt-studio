import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentStorage } from "pstdio-sync/records";
import type { RouteDeps } from "../../features/deps";
import { createRelayLogs } from "../relay/logs";
import { numberRelayFixture } from "../relay/resource-number-sync.fixture";
import { createPersonalHistoryStore, type PersonalHistoryInput } from "./store";

const relays = new Map<string, ReturnType<typeof numberRelayFixture>>();
/** Copies the private index through its real encrypted generic log transport, retaining relay state. */
export const transferPersonalIndex = async (
  source: RouteDeps["extensionStorageService"],
  destination: RouteDeps["extensionStorageService"],
  identity: Pick<PersonalHistoryInput, "projectId" | "accountId" | "managerOrigin">,
) => {
  const key = JSON.stringify(identity);
  let relay = relays.get(key);
  if (!relay) {
    relay = numberRelayFixture();
    relays.set(key, relay);
  }
  const space = await createSyncSpace({
    projectId: identity.projectId,
    spaceOwner: identity.accountId,
    keys: [{ generation: 1, secret: "B".repeat(43) }],
  });
  const history = (storage: typeof source) =>
    createPersonalHistoryStore({
      ...identity,
      documents: storage.documents,
      logs: storage.logs,
      index: storage.personalHistoryIndex,
    });
  const from = history(source);
  const to = history(destination);
  const connect = (storage: typeof source) =>
    createRelayLogs({
      owner: from.owner,
      space,
      service: storage.logs,
      relay: relay!.relay,
      signal: new AbortController().signal,
    });
  const writer = connect(source);
  const reader = connect(destination);
  try {
    await writer.publish();
    await createDocumentStorage({ owner: from.owner, store: to.records }).applyUpdate(
      await createDocumentStorage({ owner: from.owner, store: from.records }).exportUpdate(),
    );
    await to.synchronize();
  } finally {
    await Promise.all([writer.close(), reader.close()]);
  }
};
