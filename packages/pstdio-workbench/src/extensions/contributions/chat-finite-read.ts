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
  };
  return {
    query,
    observe: () => {
      const previous = release;
      release = query.subscribe(apply);
      previous?.();
      apply();
      return query.read().catch(() => undefined);
    },
    stop: () => {
      release?.();
      release = undefined;
      if (!query.active() && query.getSnapshot().fetching) query.cancel();
    },
    dispose: () => local?.dispose(),
  };
};
