import {
  matchesQueryDependency,
  type QueryChangeEnvelope,
  type ResourceRef,
  resourceKey,
} from "@pstdio/sdk/extensions";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import type { ChatRecord } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";

/** Standalone hosts can supply the same cheap feed used by a runtime query root. */
export const observeChatRendererRefresh = (
  input: RegisterWorkbenchExtensionContributionsInput,
  view: ChatRecord,
  reads: () => Iterable<{ session: ChatSession; render: { instance: { resource?: ResourceRef } } }>,
) => {
  if (input.queries) return () => {};
  const invalidate = (event: QueryChangeEnvelope) => {
    for (const owner of reads()) {
      const resource = owner.render.instance.resource;
      const normalized = resource ? (input.resolveChatResource?.(resource, input.projectId) ?? resource) : undefined;
      if (
        matchesQueryDependency(event, {
          projectId: input.projectId,
          extensionId: view.extensionId,
          resourceKey: resourceKey(normalized),
          resourceId: resource?.id,
        })
      )
        owner.session.query.invalidate();
    }
  };
  const events = input.subscribeRefreshEvents?.((event) => {
    if (view.body.refreshEventIds?.includes(event.id)) invalidate(event);
  });
  const resets = input.subscribeRefreshReset?.((event) => invalidate(event ?? {}));
  return () => {
    events?.dispose();
    resets?.dispose();
  };
};
