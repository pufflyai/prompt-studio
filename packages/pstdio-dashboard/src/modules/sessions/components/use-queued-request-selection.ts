import type { QueuedFollowUp } from "@pstdio/ui/chat-ui";
import { type Dispatch, type SetStateAction, useState } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import type { HarnessParamValues } from "./harness-param-values";
import { deleteSessionAttachment, useSessionDraftAttachments } from "./use-session-draft-attachments";

interface SavedSelection {
  item: QueuedFollowUp;
  model: string;
  params: HarnessParamValues;
}
const toAttachment = (item: NonNullable<QueuedFollowUp["attachments"]>[number]) => ({
  file_id: item.id,
  name: item.name,
  mime_type: item.mediaType ?? null,
  size_bytes: item.size ?? 0,
  hash: null,
  url: item.url ?? "",
  created_at: "",
  updated_at: "",
});

export const useQueuedRequestSelection = (
  projectId: string | undefined,
  draftKey: string,
  drafts: DashboardSessionDraftPersistence | undefined,
) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, SavedSelection>>({});
  const selection = selectedId ? edits[selectedId] : undefined;
  const targetKey = (id: string) => `${draftKey}:queued:${id}`;
  const attachments = useSessionDraftAttachments(
    projectId,
    targetKey(selectedId ?? "inactive"),
    drafts,
    selection?.item.attachments?.map((file) => file.id) ?? [],
  );
  const select = (item: QueuedFollowUp | null) => {
    if (item && !edits[item.id]) {
      setEdits((current) => ({ ...current, [item.id]: { item, model: item.model ?? "", params: item.params ?? {} } }));
      if (projectId)
        drafts
          ?.getAttachmentDraft(projectId, targetKey(item.id))
          .changeAttachments(() => (item.attachments ?? []).map(toAttachment));
    }
    setSelectedId(item?.id ?? null);
  };
  const commit = (id: string) => {
    setEdits((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (projectId) drafts?.getAttachmentDraft(projectId, targetKey(id)).changeAttachments(() => []);
    if (id === selectedId) setSelectedId(null);
  };
  const discard = (id: string) => {
    const saved = new Set(edits[id]?.item.attachments?.map((file) => file.id));
    const local = projectId
      ? (drafts?.getAttachmentDraft(projectId, targetKey(id)).getSnapshot().attachments ?? [])
      : [];
    commit(id);
    if (projectId)
      for (const file of local)
        if (!saved.has(file.file_id)) void deleteSessionAttachment(projectId, file.file_id).catch(() => undefined);
  };
  const settingsKey = (params: HarnessParamValues) =>
    JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  const dirtyItemIds = Object.entries(edits)
    .filter(([id, edit]) => {
      const files = projectId
        ? (drafts?.getAttachmentDraft(projectId, targetKey(id)).getSnapshot().attachments ?? [])
        : [];
      return (
        edit.model !== (edit.item.model ?? "") ||
        settingsKey(edit.params) !== settingsKey(edit.item.params ?? {}) ||
        JSON.stringify(files.map((file) => file.file_id)) !==
          JSON.stringify(edit.item.attachments?.map((file) => file.id) ?? [])
      );
    })
    .map(([id]) => id);
  const setModel: Dispatch<SetStateAction<string>> = (value) => {
    if (!selectedId) return;
    setEdits((current) => {
      const selected = current[selectedId];
      if (!selected) return current;
      return {
        ...current,
        [selectedId]: { ...selected, model: typeof value === "function" ? value(selected.model) : value },
      };
    });
  };
  const setParams: Dispatch<SetStateAction<HarnessParamValues>> = (value) => {
    if (!selectedId) return;
    setEdits((current) => {
      const selected = current[selectedId];
      if (!selected) return current;
      return {
        ...current,
        [selectedId]: { ...selected, params: typeof value === "function" ? value(selected.params) : value },
      };
    });
  };
  return { selection, edits, select, discard, commit, setModel, setParams, attachments, dirtyItemIds };
};
