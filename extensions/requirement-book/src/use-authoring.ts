import type { WebviewHostProps } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { FormMode } from "./authoring-form";
import type { BookClient } from "./client";
import { findRule, type Rule, removalOperations } from "./model";
import { resourceSelection } from "./resource-catalog";
import { useBook } from "./use-book";
export function useAuthoring(client: BookClient, props: WebviewHostProps) {
  const book = useBook(client);
  const { data, run } = book;
  const resource = props.resource?.type === "requirement" ? props.resource.id : "";
  const route = resourceSelection(data, props.resource, props.pageParams);
  const routeChapter = route.chapter;
  const review = String(props.pageParams.review ?? "");
  const section = route.section;
  const [selected, setSelected] = useState(resource);
  const [editor, setEditor] = useState<Rule | null>(null);
  const [removing, setRemoving] = useState<Rule | null>(null);
  const [form, setForm] = useState<FormMode | null>(null);
  const routeForm = String(props.pageParams.form ?? "");
  const ready = Boolean(data);
  useEffect(() => {
    if (!ready || !["rule", "chapter", "finding", "observation"].includes(routeForm)) return;
    setForm(routeForm as FormMode);
    setPromoteId(undefined);
    void client.page.updateParams({ form: null }).catch((error) => book.setError(String(error)));
  }, [client, routeForm, ready, book.setError]);
  const [promoteId, setPromoteId] = useState<string>();
  const [search, setSearch] = useState(false);
  const [source, setSource] = useState<{ path: string; content: string } | null>(null);
  useEffect(() => {
    setSelected(resource);
    setEditor((current) => (current?.chapter === routeChapter && !review && resource === current.ref ? current : null));
  }, [resource, routeChapter, review]);
  const chapter = findRule(data?.rules ?? [], selected)?.chapter ?? routeChapter;
  const effectiveSelected = selected || data?.rules.find((rule) => rule.chapter === chapter)?.ref || "";
  const navigateReview = async () =>
    client.navigation.open({
      kind: "page",
      page: { kind: "page", id: "book" },
      params: { chapter, review: "Suggestions" },
    });
  const open = (ref: string) => {
    const rule = findRule(data?.rules ?? [], ref);
    if (!rule) return;
    setSelected(ref);
    setEditor(null);
    run(() =>
      client.navigation.open({
        kind: "page",
        page: { kind: "page", id: "requirement" },
        resource: { type: "requirement", id: ref, label: rule.title },
      }),
    );
  };
  const edit = (rule: Rule) =>
    run(async () => {
      const result = await client.commands.get({
        workspaceId: data!.workspaceId,
        reference: rule.ref,
        revision: "working",
      });
      book.setRevision("working");
      setEditor(result.rule);
      setSelected(result.rule.ref);
    });
  const save = (rule: Rule, reason: string) =>
    run(async () => {
      if (!editor) throw new Error("Reload the current rule first.");
      await client.commands.suggest({
        workspaceId: data!.workspaceId,
        title: `Amend ${rule.title}`,
        reason,
        operations: [{ type: "AMEND", before: editor, after: rule }],
      });
      setEditor(null);
      await navigateReview();
    });
  const move = (rule: Rule, chapter: number) =>
    run(async () => {
      const current = await client.commands.get({
        workspaceId: data!.workspaceId,
        reference: rule.ref,
        revision: "working",
      });
      await client.commands.suggest({
        workspaceId: data!.workspaceId,
        title: `Move ${rule.title}`,
        reason: `Move to chapter RB${chapter}; preserve requirement identity and intent.`,
        operations: [{ type: "MOVE", before: current.rule, after: { ...current.rule, chapter } }],
      });
      await navigateReview();
    });
  const remove = () =>
    run(async () => {
      if (!removing) return;
      const current = await client.commands.read({ workspaceId: data!.workspaceId, revision: "working" });
      const target = findRule(current.rules, removing.ref);
      if (!target) throw new Error("The rule was removed on the working branch.");
      await client.commands.suggest({
        workspaceId: current.workspaceId,
        title: `Remove ${target.title}`,
        reason: "Explicit removal requested from the requirement preview, including incoming reference updates.",
        operations: removalOperations(
          { version: 1, chapters: current.chapters, rules: current.rules, retired: current.retired },
          target,
        ),
      });
      setRemoving(null);
      await navigateReview();
    });
  const map = (id: string, ref: string) =>
    run(async () => {
      await client.commands["observations.map"]({ id, reference: ref });
      book.setRevision("working");
      open(ref);
    });
  const openSource = (path: string) =>
    run(async () => {
      const result = await client.commands["sources.read"]({ workspaceId: data!.workspaceId, path });
      setSource({ path, content: result.content });
    });
  const formSaved = () => {
    book.refresh();
    if (form === "rule") run(navigateReview);
  };
  return {
    ...book,
    selected: effectiveSelected,
    setSelected,
    editor,
    setEditor,
    removing,
    setRemoving,
    form,
    setForm,
    promoteId,
    setPromoteId,
    search,
    setSearch,
    source,
    setSource,
    chapter,
    section,
    focusedId: route.focusedId,
    open,
    edit,
    save,
    remove,
    move,
    map,
    openSource,
    formSaved,
  };
}
