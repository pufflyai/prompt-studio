import { useEffect, useRef, useState } from "react";
import {
  initialThreads,
  type ReviewDraft,
  type ReviewEntry,
  type ReviewThread,
  threadMarkdown,
  ticketMarkdown,
} from "./review-fixtures";

export function useReviewPrototype() {
  const [markdown, setMarkdown] = useState(ticketMarkdown);
  const [documentText, setDocumentText] = useState("");
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>("selection");
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [failHandoff, setFailHandoff] = useState(false);
  const [session, setSession] = useState<ReviewEntry["session"]>();
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const active = threads.find((thread) => thread.id === activeId);
  const openCount = threads.filter((thread) => !thread.resolved).length;

  const openThread = (id: string) => {
    setActiveId(id);
    setShowResolved(threads.find((thread) => thread.id === id)?.resolved ?? false);
    setDraft(null);
  };
  const selectQuote = (quote: string) => {
    setActiveId(null);
    setDraft({ quote, text: "" });
    setShowResolved(false);
  };
  const reply = (thread: ReviewThread) => setDraft({ quote: thread.quote, text: "", threadId: thread.id });
  const resolve = (id: string) => {
    setThreads((current) =>
      current.map((thread) => (thread.id === id ? { ...thread, resolved: !thread.resolved } : thread)),
    );
    setActiveId(null);
    setDraft(null);
  };

  const startHandoff = (thread: ReviewThread, entry: ReviewEntry) => {
    const update = (value: Partial<ReviewEntry>) =>
      setThreads((current) =>
        current.map((item) =>
          item.id === thread.id
            ? { ...item, entries: item.entries.map((row) => (row.id === entry.id ? { ...row, ...value } : row)) }
            : item,
        ),
      );
    update({ handoff: "starting" });
    const shouldFail = failHandoff;
    const snapshot = { id: `review-${entry.id}`, ticket: markdown, thread: threadMarkdown(thread) };
    timers.current.push(
      setTimeout(() => {
        if (shouldFail) update({ handoff: "failed" });
        else update({ handoff: "linked", session: snapshot });
      }, 600),
    );
  };

  const saveDraft = () => {
    if (!draft?.text.trim()) return;
    const entry: ReviewEntry = { id: `entry-${nextId.current++}`, text: draft.text.trim(), target: draft.target };
    const existing = threads.find((thread) => thread.id === draft.threadId);
    const thread: ReviewThread = existing
      ? { ...existing, entries: [...existing.entries, entry] }
      : { id: `thread-${nextId.current++}`, quote: draft.quote, resolved: false, entries: [entry] };
    setThreads((current) =>
      existing ? current.map((row) => (row.id === existing.id ? thread : row)) : [...current, thread],
    );
    setActiveId(thread.id);
    setShowResolved(thread.resolved);
    setDraft(null);
    setConfirmation(false);
    if (entry.target) startHandoff(thread, entry);
  };

  const submit = () => {
    if (!draft?.text.trim()) return;
    if (draft.target) setConfirmation(true);
    else saveDraft();
  };

  return {
    markdown,
    setMarkdown,
    documentText,
    setDocumentText,
    threads,
    setThreads,
    active,
    activeId,
    setActiveId,
    openCount,
    showResolved,
    setShowResolved,
    draft,
    setDraft,
    confirmation,
    setConfirmation,
    failHandoff,
    setFailHandoff,
    session,
    setSession,
    openThread,
    selectQuote,
    reply,
    resolve,
    submit,
    saveDraft,
    startHandoff,
  };
}

export type ReviewPrototype = ReturnType<typeof useReviewPrototype>;
