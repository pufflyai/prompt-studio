import type { ChatDraft } from "@pstdio/sdk/extensions";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { sessionAttachmentSchema } from "pstdio-api-contracts";
import { resolveDashboardStorage } from "./dashboard-storage";
import { dashboardWorkbenchStorageNamespace } from "./dashboard-workbench-storage-keys";
import { dashboardSessionDraftStorageKey } from "./session-draft-persistence";

/** Narrow, non-destructive transfer of one session/draft in the active project; never exposes browser storage. */
export const readLegacySessionChatDraft = (projectId: string, draftKey: string, input?: WorkbenchStorageLike) => {
  const storage = resolveDashboardStorage(input);
  const textKey = dashboardSessionDraftStorageKey(dashboardWorkbenchStorageNamespace, projectId);
  const filesKey = `${dashboardWorkbenchStorageNamespace}:session-attachments:${projectId}:${draftKey}`;
  const readTexts = (): Record<string, unknown> => {
    try {
      const value = JSON.parse(storage.getItem(textKey) ?? "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  const text = readTexts()[draftKey];
  let files: unknown;
  const rawFiles = storage.getItem(filesKey);
  try {
    files = JSON.parse(rawFiles ?? "[]");
  } catch {
    files = [];
  }
  const parsed = sessionAttachmentSchema.array().safeParse(files);
  const draft: ChatDraft = {
    text: typeof text === "string" ? text : "",
    values: {},
    attachments: parsed.success
      ? parsed.data.map((file) => ({
          id: file.file_id,
          name: file.name,
          size: file.size_bytes,
          mediaType: file.mime_type ?? undefined,
          url: file.url,
        }))
      : [],
  };
  if (!draft.text && !draft.attachments.length) return undefined;
  return {
    draft,
    acknowledge: () => {
      // Only after durable destination save, and only if the original has not changed in another view.
      const texts = readTexts();
      if (!parsed.success || texts[draftKey] !== text || storage.getItem(filesKey) !== rawFiles) return;
      delete texts[draftKey];
      storage.setItem(textKey, JSON.stringify(texts));
      storage.removeItem?.(filesKey);
    },
  };
};
