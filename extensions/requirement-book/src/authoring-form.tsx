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
const openDraftEditing = (client: BookClient, workspaceId: string, chapter: number) => {
  const params = { workspaceId, chapter };
  return client.editing.openCommand<{ draft: string; revision: string }>({
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
  const editing = useRef<Promise<WebviewCommandEditingSession<{ draft: string; revision: string }>> | undefined>(
    undefined,
  );
  const [restored, setRestored] = useState<Draft>();
  const [revision, setRevision] = useState<string>();
  useEffect(() => {
    let active = true;
    const opening = openDraftEditing(client, workspaceId, draftChapter);
    editing.current = opening;
    void opening
      .then((session) => {
        const snapshot = session.getSnapshot();
        if (active) setRevision(snapshot.value.revision);
        if (active && (snapshot.pendingCommands || snapshot.error))
          setRestored({
            id: `${workspaceId}-${draftChapter}`,
            workspaceId,
            chapter: draftChapter,
            values: JSON.parse(snapshot.value.draft),
            revision: snapshot.value.revision,
          });
      })
      .catch(() => {
        if (editing.current === opening) editing.current = undefined;
      });
    return () => {
      active = false;
      const previous = editing.current;
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
    const text = JSON.stringify(values);
    await session.execute(
      { draft: text, expectedRevision },
      { channel: "document", changes: [{ path: ["draft"], value: text }] },
    );
    const snapshot = session.getSnapshot().value;
    const saved = JSON.parse(snapshot.draft);
    if (
      Object.keys(values).length !== Object.keys(saved).length ||
      Object.entries(values).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key]))
    )
      throw new Error("The draft changed in another view.");
    setRevision(snapshot.revision);
    onDraftSaved({
      id: `${workspaceId}-${draftChapter}`,
      workspaceId,
      chapter: draftChapter,
      values: saved,
      revision: snapshot.revision,
    });
    return snapshot.revision;
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
      draftRevision={(draft?.submissionId ? draft : (restored ?? draft))?.revision ?? revision}
      canDiscardSubmission={draft?.submissionStatus !== "writing" && Boolean(draft?.revision ?? revision)}
      onSubmit={submit}
      onClose={onClose}
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
