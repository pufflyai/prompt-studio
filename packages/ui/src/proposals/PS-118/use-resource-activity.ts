import { useEffect, useRef, useState } from "react";
import {
  type ActivityChange,
  author,
  initialResources,
  type PrototypeResource,
  type ResourceEvent,
  type ReviewDraft,
  type ReviewEntry,
  type ReviewThread,
  type SessionSnapshot,
  threadMarkdown,
} from "./review-fixtures";

export function useResourceActivity() {
  const [resources, setResources] = useState(initialResources);
  const [resourceId, setResourceId] = useState("PS-118");
  const [documentText, setDocumentText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [failHandoff, setFailHandoff] = useState(false);
  const [session, setSession] = useState<SessionSnapshot>();
  const [change, setChange] = useState<ActivityChange>();
  const [focusRequest, setFocusRequest] = useState(0);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const resource = resources.find((item) => item.id === resourceId) ?? resources[0];
  const activity = resource.activity;
  const threads = activity?.items.filter((item): item is ReviewThread => item.kind === "comment") ?? [];
  const openCount = threads.filter((thread) => !thread.resolved).length;
  const draft = activity?.draft;
  const id = () => `activity-${nextId.current++}`;
  const event = (message: string): ResourceEvent => ({
    kind: "event",
    id: id(),
    actor: author,
    message,
    timestamp: "Just now",
  });
  const update = (targetId: string, fn: (value: PrototypeResource) => PrototypeResource) =>
    setResources((current) => current.map((item) => (item.id === targetId ? fn(item) : item)));

  const setDraft = (value: ReviewDraft) =>
    update(resourceId, (current) =>
      current.activity ? { ...current, activity: { ...current.activity, draft: value } } : current,
    );
  const selectQuote = (quote: string) => {
    if (!activity?.comments) return;
    setDraft({ text: "", quote });
    setActiveId(null);
    setFocusRequest((value) => value + 1);
  };
  const reply = (thread: ReviewThread) => {
    setDraft({ text: "", threadId: thread.id });
    setActiveId(thread.id);
    setFocusRequest((value) => value + 1);
  };
  const openThread = (threadId: string) => {
    setActiveId(threadId);
    setFocusRequest((value) => value + 1);
  };
  const resolve = (thread: ReviewThread) => {
    const resolved = !thread.resolved;
    const item = event(resolved ? "resolved a comment" : "reopened a comment");
    update(resourceId, (current) => {
      if (!current.activity) return current;
      const items = current.activity.items.map((row) => (row.id === thread.id ? { ...thread, resolved } : row));
      if (current.activity.trackChanges) items.push(item);
      return { ...current, activity: { ...current.activity, items } };
    });
  };
  const setStatus = (status: string) => {
    if (status === resource.status) return;
    const item = event(`changed status from ${resource.status} to ${status}`);
    update(resourceId, (current) => ({
      ...current,
      status,
      activity: current.activity ? { ...current.activity, items: [...current.activity.items, item] } : undefined,
    }));
  };
  const editBody = (markdown: string) =>
    update(resourceId, (current) => ({
      ...current,
      markdown,
      activity: current.activity?.trackChanges
        ? { ...current.activity, pendingBody: current.activity.pendingBody ?? current.markdown }
        : current.activity,
    }));
  const recordBodyChange = () => {
    const item = event("updated the description");
    update(resourceId, (current) => {
      const state = current.activity;
      if (!state || state.pendingBody === undefined) return current;
      const items = [...state.items];
      if (state.pendingBody !== current.markdown)
        items.push({ ...item, change: { before: state.pendingBody, after: current.markdown } });
      return { ...current, activity: { ...state, items, pendingBody: undefined } };
    });
  };
  const startHandoff = (thread: ReviewThread, entry: ReviewEntry) => {
    const targetId = resourceId;
    const patchEntry = (patch: Partial<ReviewEntry>, completion?: ResourceEvent) =>
      update(targetId, (current) => {
        if (!current.activity) return current;
        const items = current.activity.items.map((item) =>
          item.kind === "comment" && item.id === thread.id
            ? { ...item, entries: item.entries.map((row) => (row.id === entry.id ? { ...row, ...patch } : row)) }
            : item,
        );
        if (completion && current.activity.trackChanges) items.push(completion);
        return { ...current, activity: { ...current.activity, items } };
      });
    patchEntry({ handoff: "starting" });
    const snapshot: SessionSnapshot = {
      id: `session-${entry.id}`,
      resourceId,
      label: resource.label,
      body: resource.markdown,
      thread: threadMarkdown(resource, thread),
    };
    const shouldFail = failHandoff;
    const completion = event(`started a session with @${entry.target?.handle}`);
    timers.current.push(
      setTimeout(() => {
        if (shouldFail) patchEntry({ handoff: "failed" });
        else patchEntry({ handoff: "linked", session: snapshot }, completion);
      }, 600),
    );
  };
  const saveDraft = () => {
    if (!activity?.comments || !draft?.text.trim()) return;
    const entry: ReviewEntry = { id: id(), text: draft.text.trim(), target: draft.target };
    const existing = threads.find((thread) => thread.id === draft.threadId);
    const thread: ReviewThread = existing
      ? { ...existing, entries: [...existing.entries, entry] }
      : { kind: "comment", id: id(), quote: draft.quote, resolved: false, entries: [entry] };
    update(resourceId, (current) => {
      if (!current.activity) return current;
      const items = existing
        ? current.activity.items.map((item) => (item.id === thread.id ? thread : item))
        : [...current.activity.items, thread];
      return { ...current, activity: { ...current.activity, items, draft: { text: "" } } };
    });
    setActiveId(thread.id);
    setConfirmation(false);
    if (entry.target) startHandoff(thread, entry);
  };
  const submit = () => {
    if (!draft?.text.trim()) return;
    if (draft.target) setConfirmation(true);
    else saveDraft();
  };
  const selectResource = (targetId: string) => {
    recordBodyChange();
    setResourceId(targetId);
    setActiveId(null);
    setDocumentText("");
  };
  return {
    resources,
    resource,
    activity,
    threads,
    draft,
    openCount,
    documentText,
    setDocumentText,
    activeId,
    confirmation,
    setConfirmation,
    failHandoff,
    setFailHandoff,
    session,
    setSession,
    change,
    setChange,
    focusRequest,
    setDraft,
    selectQuote,
    reply,
    openThread,
    resolve,
    setStatus,
    editBody,
    recordBodyChange,
    startHandoff,
    saveDraft,
    submit,
    selectResource,
  };
}

export type ResourceActivityController = ReturnType<typeof useResourceActivity>;
