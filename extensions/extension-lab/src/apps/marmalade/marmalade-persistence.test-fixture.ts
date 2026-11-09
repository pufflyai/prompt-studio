import type { ExtensionStorageApi, QueryChangeEnvelope } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";

export const marmaladeContext = (
  projectId: string,
  source = createMemoryStorage({ extensionId: "pstdio.extension-lab" }),
) => {
  const reads: string[] = [];
  const commits: Parameters<ExtensionStorageApi["records"]["commit"]>[0][] = [];
  const events: (Omit<QueryChangeEnvelope, "projectId"> | undefined)[] = [];
  let listener: ((event: Omit<QueryChangeEnvelope, "projectId"> | undefined) => void) | undefined;
  let lostAcknowledgement = false;
  let refuse = false;
  let afterRead: { id: string; run(): Promise<void> } | undefined;
  let beforeCommit: (() => Promise<void>) | undefined;
  const storage: ExtensionStorageApi = {
    ...source,
    records: {
      ...source.records,
      async read(id, branch) {
        reads.push(id);
        const record = await source.records.read(id, branch);
        if (afterRead?.id === id) {
          const next = afterRead;
          afterRead = undefined;
          await next.run();
        }
        return record;
      },
      async commit(group) {
        commits.push(structuredClone(group));
        if (refuse) {
          refuse = false;
          return { operationId: group.operationId, state: "refused", status: "saved-locally", reason: "Refused" };
        }
        const before = beforeCommit;
        beforeCommit = undefined;
        await before?.();
        const result = await source.records.commit(group);
        if (lostAcknowledgement) {
          lostAcknowledgement = false;
          throw new Error("Acknowledgement lost");
        }
        return result;
      },
    },
  };
  const ctx = makeCommandContext({
    storage,
    projectId,
    params: {},
    overrides: {
      extensionId: "pstdio.extension-lab",
      events: {
        emit: async (_event, _payload, options) => {
          events.push(options?.refresh);
          listener?.(options?.refresh);
          return { delivered: 0 };
        },
      },
    },
  });
  return {
    ctx,
    storage,
    source,
    reads,
    commits,
    events,
    observeEvents(next: typeof listener) {
      listener = next;
    },
    reset() {
      reads.length = 0;
      commits.length = 0;
      events.length = 0;
    },
    loseAcknowledgement() {
      lostAcknowledgement = true;
    },
    afterNextRead(id: string, run: () => Promise<void>) {
      afterRead = { id, run };
    },
    beforeNextCommit(run: () => Promise<void>) {
      beforeCommit = run;
    },
    refuseNext() {
      refuse = true;
    },
  };
};
