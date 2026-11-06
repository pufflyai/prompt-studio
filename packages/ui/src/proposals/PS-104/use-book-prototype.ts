import { useEffect, useState } from "react";
import { findRule, initialRules, type Rule, type Section } from "./book-model";
import { reviewItems, unreadCounts } from "./book-review-model";
import type { SuggestionAction } from "./book-suggestion";
import {
  applySuggestion,
  initialWorkflow,
  mapObservation,
  type Operation,
  reconcileSuggestion,
  reviewSuggestion,
  stageSuggestion,
  type Workflow,
} from "./book-workflow";

export function useBookPrototype() {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow);
  const [revision, setRevision] = useState<"accepted" | "branch">("accepted");
  const [section, setSection] = useState<Section | null>(null);
  const [chapter, setChapter] = useState(1);
  const [selected, setSelected] = useState("RB 1.A.1");
  const [editor, setEditor] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Rule | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState("");
  const rules = revision === "accepted" ? initialRules : workflow.branch;
  const observations = workflow.observations.filter((item) => !item.requirements.length);
  const records = [
    ...reviewItems,
    ...observations.map((item) => ({ id: item.id, section: "Undocumented" as const })),
    ...workflow.suggestions.map((item) => ({ id: item.id, section: "Suggestions" as const })),
  ];
  const unread = unreadCounts(workflow.readIds, records);
  const markRead = (id: string) =>
    setWorkflow((current) => ({ ...current, readIds: [...new Set([...current.readIds, id])] }));
  useEffect(() => {
    const handleSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleSearch);
    return () => window.removeEventListener("keydown", handleSearch);
  }, []);
  const openChapter = (id: number) => {
    setSection(null);
    setChapter(id);
    setEditor(null);
    setError("");
    setSelected(rules.find((rule) => rule.chapter === id)?.ref ?? "");
  };
  const openRule = (ref: string) => {
    const rule = findRule(rules, ref) ?? findRule(workflow.branch, ref) ?? findRule(initialRules, ref);
    if (!rule) {
      setError(`This reference is not in either sample revision: ${ref}`);
      return;
    }
    if (!findRule(rules, ref)) setRevision(findRule(workflow.branch, ref) ? "branch" : "accepted");
    setSection(null);
    setChapter(rule.chapter);
    setSelected(ref);
    setEditor(null);
    setError("");
  };
  const stage = (title: string, operations: Operation[]) => {
    setWorkflow(stageSuggestion(workflow, title, operations));
    setEditor(null);
    setSection("Suggestions");
    setError("");
  };
  const suggestionAction = (id: string, action: SuggestionAction) => {
    try {
      let next = workflow;
      if (action === "review") next = reviewSuggestion(workflow, id);
      if (action === "apply") {
        next = applySuggestion(workflow, id);
        setRevision("branch");
      }
      if (action === "reconcile") next = reconcileSuggestion(workflow, id);
      if (action === "discard")
        next = { ...workflow, suggestions: workflow.suggestions.filter((item) => item.id !== id) };
      if (action === "change-target") {
        const target = workflow.suggestions
          .find((item) => item.id === id)
          ?.operations.find((operation) => operation.before)?.before;
        if (target)
          next = {
            ...workflow,
            branch: workflow.branch.map((rule) =>
              rule.ref === target.ref
                ? { ...rule, statement: `${rule.statement} Updated on the sample working branch.` }
                : rule,
            ),
          };
      }
      setWorkflow({ ...next, readIds: [...new Set([...next.readIds, id])] });
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  const map = (id: string, ref: string) => {
    const next = mapObservation(workflow, id, ref);
    setWorkflow({ ...next, readIds: [...new Set([...next.readIds, id])] });
    const rule = findRule(workflow.branch, ref)!;
    setRevision("branch");
    setSection(null);
    setChapter(rule.chapter);
    setSelected(ref);
    setEditor(null);
  };
  return {
    workflow,
    setWorkflow,
    revision,
    setRevision,
    section,
    setSection,
    chapter,
    setChapter,
    selected,
    setSelected,
    editor,
    setEditor,
    creating,
    setCreating,
    removing,
    setRemoving,
    searchOpen,
    setSearchOpen,
    error,
    setError,
    rules,
    observations,
    records,
    unread,
    markRead,
    openChapter,
    openRule,
    stage,
    suggestionAction,
    map,
  };
}
