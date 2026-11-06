import { BookForm } from "./book-form";
import type { BookClient } from "./client";
import { findingFields, observationFields, ruleFields, splitLines, splitRefs } from "./forms";
import { ruleSchema } from "./model";
import type { BookData } from "./read";
import type { Draft } from "./records";
export type FormMode = "rule" | "observation" | "finding" | "chapter";
interface Props {
  mode: FormMode;
  chapter: number;
  data: BookData;
  client: BookClient;
  promoteId?: string;
  onClose: () => void;
  onSaved: () => void;
  onDraftSaved: (draft: Draft) => void;
}
export function AuthoringForm(props: Props) {
  const { mode, chapter, data, client, promoteId, onClose, onSaved, onDraftSaved } = props;
  const draftChapter = mode === "rule" ? chapter : -["observation", "finding", "chapter"].indexOf(mode) - 1;
  const fields = {
    rule: ruleFields(data.chapters.find((item) => item.id === chapter)?.title ?? "Project"),
    observation: observationFields,
    finding: findingFields,
    chapter: [
      { id: "title", label: "Chapter title", type: "text" as const, required: true },
      { id: "group", label: "Group: Core or Extensions", type: "text" as const, required: true, defaultValue: "Core" },
    ],
  }[mode];
  const title = {
    rule: promoteId ? "Propose a rule from evidence" : "New rule",
    observation: "Record observation",
    finding: "New finding",
    chapter: "New chapter",
  }[mode];
  const submit = async (values: Record<string, unknown>) => {
    if (mode === "rule") {
      const rule = ruleSchema.parse({
        ref: `RB ${chapter}.A.${crypto.randomUUID().replaceAll("-", "")}`,
        chapter,
        level: Number(values.level),
        scope: String(values.scope),
        title: String(values.title),
        statement: String(values.statement),
        rationale: "",
        status: "proposed",
        section: Number(values.level) === 3 ? "Contracts" : "Behavior",
        acceptance: [{ statement: String(values.acceptance), tests: splitLines(values.tests) }],
        related: splitRefs(values.related),
        governing: [],
      });
      if (promoteId)
        await client.commands["observations.promote"]({ id: promoteId, rule, reason: String(values.reason) });
      else
        await client.commands.suggest({
          workspaceId: data.workspaceId,
          title: `Add ${rule.title}`,
          reason: String(values.reason),
          operations: [{ type: "ADD", before: null, after: rule }],
        });
    } else if (mode === "observation")
      await client.commands["observations.save"]({
        workspaceId: data.workspaceId,
        title: String(values.title),
        claim: String(values.claim),
        kind: String(values.kind),
        conditions: String(values.conditions),
        limits: String(values.limits),
        sources: splitLines(values.sources),
      });
    else if (mode === "finding")
      await client.commands["findings.save"]({
        workspaceId: data.workspaceId,
        title: String(values.title),
        kind: String(values.kind),
        explanation: String(values.explanation),
        requirements: splitRefs(values.requirements),
        evidence: splitLines(values.evidence),
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
