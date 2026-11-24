import type { WebviewCommandEditingSession } from "@pstdio/sdk/extensions";
import { useEffect, useRef, useState } from "react";
import { BookForm } from "./book-form";
import type { BookClient } from "./client";
import { chapterFields, draftChapterFor, findingFields, ruleFields } from "./forms";
import type { BookData } from "./read";
import { changed, type Draft } from "./records";
export type FormMode = "rule" | "finding" | "chapter";
interface Props {
  mode: FormMode;
  chapter: number;
  data: BookData;
  client: BookClient;
  onClose: () => void;
  onSaved: () => void;
  onDraftSaved: (draft: Draft) => void;
}
type DraftSnapshot = { draft: string; revision: string; draftBase?: string };

const openDraftEditing = (client: BookClient, workspaceId: string, chapter: number) => {
  const params = { workspaceId, chapter };
  return client.editing.openCommand<DraftSnapshot>({
    key: JSON.stringify(["authoring-draft", workspaceId, chapter]),
    read: { commandId: `${changed.extensionId}.command.drafts.read-editing`, params },
    command: { commandId: `${changed.extensionId}.command.drafts.save-editing`, params },
    dependsOn: [changed],
  });
};

export function AuthoringForm(props: Props) {
  const { mode, chapter, data, client, onClose, onSaved, onDraftSaved } = props;
  const draftChapter = draftChapterFor(mode, chapter);
  const { workspaceId } = data;
  const draft = data.drafts.find((item) => item.chapter === draftChapter);
  const editing = useRef<Promise<WebviewCommandEditingSession<DraftSnapshot>> | undefined>(undefined);
  const activeEditing = useRef<WebviewCommandEditingSession<DraftSnapshot> | undefined>(undefined);
  const [restored, setRestored] = useState<Draft>();
  const [revision, setRevision] = useState<string>();
  const [draftError, setDraftError] = useState<string>();
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setRevision(undefined);
    setRestored(undefined);
    setDraftError(undefined);
    const opening = openDraftEditing(client, workspaceId, draftChapter);
    editing.current = opening;
    void opening
      .then((session) => {
        if (!active) return;
        activeEditing.current = session;
        const hydrate = () => {
          const snapshot = session.getSnapshot();
          if (!active || snapshot.retired) return;
          const draftRevision = snapshot.value.draftBase ?? snapshot.value.revision;
          setRestored({
            id: `${workspaceId}-${draftChapter}`,
            workspaceId,
            chapter: draftChapter,
            values: JSON.parse(snapshot.value.draft),
            revision: draftRevision,
          });
          if (snapshot.pendingCommands && !snapshot.error) return;
          setRevision(draftRevision);
          setDraftError(snapshot.error?.message);
          unsubscribe?.();
        };
        unsubscribe = session.subscribe(hydrate);
        hydrate();
      })
      .catch(() => {
        if (editing.current === opening) editing.current = undefined;
      });
    return () => {
      active = false;
      unsubscribe?.();
      const previous = editing.current;
      activeEditing.current = undefined;
      editing.current = undefined;
      void previous?.then((session) => session.close()).catch(() => {});
    };
  }, [client, workspaceId, draftChapter]);
  const saveDraft = async (values: Record<string, unknown>, expectedRevision: string) => {
    editing.current ??= openDraftEditing(client, workspaceId, draftChapter);
    const opening = editing.current;
    const session = await opening.catch((error) => {
      if (editing.current === opening) editing.current = undefined;
      throw error;
    });
    activeEditing.current = session;
    const savedRevision = await client.saveDraft(session.id, JSON.stringify(values), expectedRevision);
    setRevision(savedRevision);
    setDraftError(undefined);
    onDraftSaved({
      id: `${workspaceId}-${draftChapter}`,
      workspaceId,
      chapter: draftChapter,
      values,
      revision: savedRevision,
    });
    return savedRevision;
  };
  const fields = {
    rule: ruleFields(),
    finding: findingFields,
    chapter: chapterFields,
  }[mode];
  const title = {
    rule: "New rule",
    finding: "New finding",
    chapter: "New chapter",
  }[mode];
  const submit = async (values: Record<string, unknown>, expectedRevision: string) => {
    const result = await client.commands["drafts.submit"]({ workspaceId, chapter, mode, values, expectedRevision });
    onSaved();
    void client.commands["drafts.discard"]({
      workspaceId,
      chapter: draftChapter,
      submissionId: result.submissionId,
    }).catch(() => {});
  };
  return (
    <BookForm
      title={title}
      fields={fields}
      submitLabel={mode === "rule" ? "Create suggestion" : "Create"}
      draft={draft?.submissionId ? draft : (restored ?? draft)}
      submissionStatus={draft?.submissionStatus}
      draftError={draftError}
      draftRevision={
        revision === undefined ? undefined : ((draft?.submissionId ? draft : (restored ?? draft))?.revision ?? revision)
      }
      canDiscardSubmission={draft?.submissionStatus !== "writing" && Boolean(draft?.revision ?? revision)}
      onSubmit={submit}
      onClose={onClose}
      onPreviewDraft={(values, expectedRevision) => {
        const session = activeEditing.current;
        if (session)
          void client
            .retainDraft(session.id, { text: JSON.stringify(values), baseRevision: expectedRevision })
            .catch(() => {});
      }}
      onSaveDraft={saveDraft}
      onCheckSubmission={
        draft?.submissionId && draft.submissionProof
          ? async () => {
              const result = await client.commands["drafts.check-submission"]({
                workspaceId,
                chapter: draftChapter,
                submissionId: draft.submissionId!,
              });
              return result.confirmed;
            }
          : undefined
      }
      onDiscard={async (expectedRevision) => {
        const session = activeEditing.current;
        if (session) await client.retainDraft(session.id, null);
        await client.commands["drafts.discard"]({
          workspaceId,
          chapter: draftChapter,
          submissionId: draft?.submissionId,
          expectedRevision,
        });
      }}
    />
  );
}
