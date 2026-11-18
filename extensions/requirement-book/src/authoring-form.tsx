import { BookForm } from "./book-form";
import type { BookClient } from "./client";
import { acceptanceConditions, chapterFields, draftChapterFor, findingFields, ruleFields, splitRefs } from "./forms";
import { createRuleReference, ruleSchema } from "./model";
import type { BookData } from "./read";
import type { Draft } from "./records";
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
export function AuthoringForm(props: Props) {
  const { mode, chapter, data, client, onClose, onSaved, onDraftSaved } = props;
  const draftChapter = draftChapterFor(mode, chapter);
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
  const submit = async (values: Record<string, unknown>) => {
    if (mode === "rule") {
      const targetChapter = data.chapters.find((item) => item.id === chapter);
      if (!targetChapter) throw new Error("Choose an existing chapter.");
      const rule = ruleSchema.parse({
        ref: createRuleReference(targetChapter),
        chapter,
        level: 2,
        title: String(values.title),
        statement: String(values.statement),
        rationale: "",
        status: "proposed",
        section: "Behavior",
        acceptance: acceptanceConditions(values.acceptance),
        related: splitRefs(values.related),
        governing: [],
      });
      await client.commands.suggest({
        workspaceId: data.workspaceId,
        title: `Add ${rule.title}`,
        reason: String(values.reason),
        operations: [{ type: "ADD", before: null, after: rule }],
      });
    } else if (mode === "finding")
      await client.commands["findings.save"]({
        workspaceId: data.workspaceId,
        title: String(values.title),
        kind: String(values.kind),
        explanation: String(values.explanation),
        requirements: splitRefs(values.requirements),
      });
    else
      await client.commands["chapters.create"]({
        workspaceId: data.workspaceId,
        title: String(values.title),
        group: String(values.group),
      });
    onSaved();
  };
  return (
    <BookForm
      title={title}
      fields={fields}
      submitLabel={mode === "rule" ? "Create suggestion" : "Create"}
      draft={data.drafts.find((item) => item.chapter === draftChapter)}
      onSubmit={submit}
      onClose={onClose}
      onSaveDraft={async (values) => {
        const draft = await client.commands["drafts.save"]({
          workspaceId: data.workspaceId,
          chapter: draftChapter,
          values,
        });
        onDraftSaved(draft);
      }}
      onDiscard={async () => {
        await client.commands["drafts.discard"]({ workspaceId: data.workspaceId, chapter: draftChapter });
      }}
    />
  );
}
