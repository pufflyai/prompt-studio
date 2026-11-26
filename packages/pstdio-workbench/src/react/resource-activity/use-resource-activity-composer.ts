import type { PublishResourceActivity, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { type ActivityDraft, emptyActivityDraft, resourceActivityDraft } from "./resource-activity-drafts";

export const useResourceActivityComposer = (
  workbench: WorkbenchCore,
  binding: ResourceActivityBinding,
  resource: ResourceRef,
  options: { replyToId?: string; onPublished?(): Promise<unknown>; onAction?(): void } = {},
) => {
  const { replyToId, onPublished, onAction } = options;
  const store = resourceActivityDraft(workbench, resourceKey(resource), replyToId);
  const draft = useSyncExternalStore(store.subscribe, store.get, store.get);
  const changeDraft = (next: ActivityDraft) => store.set(next);
  const action = async <T>(run: () => Promise<T>, upload?: string) => {
    const lease = store.begin(upload);
    if (!lease) return;
    store.setError(undefined);
    onAction?.();
    try {
      return await run();
    } catch (error) {
      store.setError(error instanceof Error ? error.message : String(error));
    } finally {
      store.finish(lease);
    }
  };
  const attach = async (input: File | File[]) => {
    const files = Array.isArray(input) ? input : [input];
    if (!files.length) return;
    return action(
      async () => {
        for (const file of files) {
          try {
            const attachment = await binding.api.attach(resource, {
              name: file.name,
              mimeType: file.type || "application/octet-stream",
              data: new Uint8Array(await file.arrayBuffer()),
            });
            const current = store.get();
            changeDraft({ ...current, attachments: [...current.attachments, attachment], key: crypto.randomUUID() });
          } catch (error) {
            throw new Error(`Could not attach ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      },
      files.length === 1 ? files[0]!.name : `${files.length} files`,
    );
  };
  const publish = async () =>
    action(async () => {
      const current = store.get();
      const input: PublishResourceActivity = {
        key: current.key,
        kind: "comment",
        body: current.body,
        replyToId,
        attachmentIds: current.attachments.map((file) => file.id),
      };
      const entry = await binding.api.publish(resource, input);
      if (store.get().key === input.key) store.set(emptyActivityDraft());
      await onPublished?.();
      return entry;
    });
  return {
    draft,
    attach,
    changeDraft,
    error: store.error(),
    clearError: () => store.setError(undefined),
    busy: store.busy(),
    uploading: store.uploading(),
    action,
    publish,
  };
};
