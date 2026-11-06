import { useState } from "react";
import { KanbanRendererCreateDialog } from "../../components/kanban-renderer/kanban-renderer-create-dialog";
import type { KanbanRendererCreateRowConfig } from "../../components/kanban-renderer/types";
import { HostStorageProvider } from "../../utils/host-storage";
import { chapters, findRule, type Rule } from "./book-model";

interface CreateDialogProps {
  open: boolean;
  chapter: number;
  rules: Rule[];
  onClose: () => void;
  onCreate: (draft: Omit<Rule, "ref">) => void;
}
export function BookCreateDialog({ open, chapter, rules, onClose, onCreate }: CreateDialogProps) {
  const [storage] = useState(() => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  });
  const config: KanbanRendererCreateRowConfig = {
    title: "New rule",
    submitLabel: "Create rule",
    fields: [
      { id: "title", label: "Title", type: "text", required: true },
      { id: "statement", label: "Requirement", type: "longtext", required: true },
      { id: "acceptance", label: "Acceptance", type: "longtext", required: true },
      { id: "tests", label: "Tests", type: "longtext", required: true, defaultValue: chapters[chapter - 1].test },
      { id: "related", label: "Related requirements", type: "text", placeholder: "RB 1.A.1, RB 2.A.1" },
    ],
    labels: {
      cancel: "Cancel",
      properties: "Properties",
      submitError: "Could not create rule",
      removeFile: "Remove file",
    },
  };
  return (
    <HostStorageProvider storage={storage}>
      <KanbanRendererCreateDialog
        open={open}
        columnId={String(chapter)}
        attributes={[]}
        config={config}
        draftKey={`requirement-book-${chapter}`}
        onClose={onClose}
        onSubmit={({ values }) => {
          const related = String(values.related ?? "")
            .split(",")
            .map((ref) => ref.trim())
            .filter(Boolean);
          const unknown = related.filter((ref) => !findRule(rules, ref));
          if (unknown.length) throw new Error(`Choose existing requirements: ${unknown.join(", ")}`);
          onCreate({
            chapter,
            section: "Behavior",
            title: String(values.title).trim(),
            statement: String(values.statement).trim(),
            acceptance: [
              {
                statement: String(values.acceptance).trim(),
                tests: String(values.tests)
                  .split("\n")
                  .map((path) => path.trim())
                  .filter(Boolean),
              },
            ],
            related,
          });
        }}
      />
    </HostStorageProvider>
  );
}
