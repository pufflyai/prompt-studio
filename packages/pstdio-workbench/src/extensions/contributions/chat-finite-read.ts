import {
  createScopedQueryClient,
  type QueryScope,
  type ScopedQueryClient,
  type ScopedQueryDescriptor,
} from "@pstdio/sdk/extensions";
import { chatRendererSnapshotSchema } from "pstdio-api-contracts";
import type { ChatSessionInput } from "./chat-session";

export interface ChatQueryContext {
  queries: ScopedQueryClient;
  scope: Partial<QueryScope>;
  descriptor: Pick<ScopedQueryDescriptor<unknown>, "id" | "params" | "resourceKey" | "dependsOn" | "dependency">;
}

export const createChatFiniteRead = (input: {
  context?: ChatQueryContext;
  read: ChatSessionInput["query"];
  issue: () => number;
  merge: (value: ReturnType<typeof chatRendererSnapshotSchema.parse>, issued: number) => void;
  publish: (update: { loading: boolean; error?: string }) => void;
  loaded: () => boolean;
}) => {
  const local = input.context ? undefined : createScopedQueryClient({ runtimeId: "chat", extensionId: "chat" });
  const queries = input.context?.queries ?? local!;
  const query = queries.forScope(input.context?.scope ?? {}).query({
    id: "chat.snapshot",
    ...input.context?.descriptor,
    read: async (signal) => {
      const issued = input.issue();
      return { value: chatRendererSnapshotSchema.parse(await input.read(signal)), issued };
    },
  });
  let accepted: ReturnType<typeof query.getSnapshot>["data"];
  let release: (() => void) | undefined;
  let appliedError: Error | undefined;
  let settle = () => {};
  const apply = () => {
    const snapshot = query.getSnapshot();
    if (snapshot.data && snapshot.data !== accepted) {
      accepted = snapshot.data;
      input.merge(snapshot.data.value, snapshot.data.issued);
    }
    const errorChanged = snapshot.error !== appliedError;
    appliedError = snapshot.error;
    input.publish({
      loading: !input.loaded() && snapshot.fetching,
      ...(errorChanged ? { error: snapshot.error?.message } : {}),
    });
    if (!query.getSnapshot().fetching && !query.inspect().stale) settle();
  };
  return {
    query,
    observe: () => {
      settle();
      const loaded = Promise.withResolvers<void>();
      settle = loaded.resolve;
      const previous = release;
      release = query.subscribe(apply);
      previous?.();
      apply();
      return loaded.promise;
    },
    stop: () => {
      release?.();
      release = undefined;
      settle();
    },
    dispose: () => local?.dispose(),
  };
};
