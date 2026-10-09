import { useEffect, useState } from "react";
import type { PromptSelectionSnapshot } from "../../rich-text/prompt-input/plugins/preserve-selection-plugin";
import { createSerializedPromptState } from "../utils/editor-state";
import type { ChatInputQuestionResponse } from "./chat-input-question-prompt";
import type { QueuedFollowUp } from "./message-types";

interface QueuedFollowUpComposerInput {
  queuedFollowUps: QueuedFollowUp[];
  defaultValue: string;
  onChange?: (text: string) => void;
  onSubmit?: (
    text: string,
    attachments: string[],
    questionResponse?: ChatInputQuestionResponse,
  ) => void | Promise<void>;
  onUpdate?: (itemId: string, prompt: string) => void | Promise<void>;
  onCreate?: (itemId: string, prompt: string) => void | Promise<void>;
  onRestoreDraft?: (itemId: string) => void;
  canRestoreDraft?: boolean;
  disabled?: boolean;
  onSelect?: (item: QueuedFollowUp | null) => void;
  onDiscard?: (itemId: string) => void;
}

export const useQueuedFollowUpComposer = (input: QueuedFollowUpComposerInput) => {
  const {
    queuedFollowUps,
    defaultValue,
    onChange,
    onSubmit,
    onUpdate,
    onCreate,
    onRestoreDraft,
    canRestoreDraft = false,
    disabled = false,
    onSelect,
    onDiscard,
  } = input;
  const [editingItem, setEditingItem] = useState<QueuedFollowUp | null>(null);
  const [edits, setEdits] = useState<Record<string, { text: string; state: string }>>({});
  const [draftState, setDraftState] = useState<{ text: string; state: string } | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [selections, setSelections] = useState<Record<string, PromptSelectionSnapshot>>({});
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [recoveredItemId, setRecoveredItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const savedItem = queuedFollowUps.find((item) => item.id === editingItem?.id);
  const createNew = Boolean(editingItem && !savedItem);
  const stale = Boolean(
    editingItem && savedItem && editingItem.revision && editingItem.revision !== savedItem.revision,
  );
  const inputValue = editingItem ? (edits[editingItem.id]?.text ?? editingItem.prompt) : defaultValue;
  const savedDraftState = draftState?.text === defaultValue ? draftState.state : undefined;
  const editorState = editingItem ? edits[editingItem.id]?.state : savedDraftState;
  const select = (item: QueuedFollowUp | null) => {
    setEditingItem(item);
    setError(null);
    setNotice(null);
    onSelect?.(item);
    setFocusSignal((signal) => signal + 1);
  };
  useEffect(() => {
    if (!editingItem || savedItem || updating || disabled || recoveredItemId === editingItem.id) return;
    setRecoveredItemId(editingItem.id);
    if (!canRestoreDraft || !onChange || defaultValue.trim() || queuedFollowUps.length) return;
    // The host moves settings and files before the editor gives the draft its text.
    onRestoreDraft?.(editingItem.id);
    setDraftState({ text: inputValue, state: editorState ?? createSerializedPromptState(inputValue) });
    setSelections((current) => ({ ...current, draft: current[editingItem.id] }));
    onChange(inputValue);
    setEdits((current) => {
      const next = { ...current };
      delete next[editingItem.id];
      return next;
    });
    setEditingItem(null);
    setError(null);
    onSelect?.(null);
    setFocusSignal((signal) => signal + 1);
    setNotice("This request was sent. Your edit moved to the draft.");
  }, [
    editingItem,
    savedItem,
    updating,
    disabled,
    recoveredItemId,
    canRestoreDraft,
    defaultValue,
    queuedFollowUps.length,
    onRestoreDraft,
    inputValue,
    editorState,
    onChange,
    onSelect,
  ]);
  const change = (text: string) => {
    if (!editingItem) {
      onChange?.(text);
      return;
    }
    setEdits((current) => ({ ...current, [editingItem.id]: { text, state: createSerializedPromptState(text) } }));
  };
  const changeState = (text: string, state: string) => {
    if (!editingItem) {
      setDraftState({ text, state });
      return;
    }
    setEdits((current) => ({ ...current, [editingItem.id]: { text, state } }));
  };
  const discard = () => {
    if (editingItem) {
      onDiscard?.(editingItem.id);
      setEdits((current) => {
        const next = { ...current };
        delete next[editingItem.id];
        return next;
      });
    }
    select(null);
  };
  const submit = async (text: string, attachments: string[], questionResponse?: ChatInputQuestionResponse) => {
    if (questionResponse) return onSubmit?.(text, attachments, questionResponse);
    if (!editingItem) return onSubmit?.(text, attachments);
    if (stale || updating) throw new Error("Select the saved request again before updating.");
    setUpdating(true);
    try {
      if (createNew) {
        if (!onCreate) throw new Error("This conversation cannot create a new queue item.");
        await onCreate(editingItem.id, text);
      } else await onUpdate?.(editingItem.id, text);
      setEdits((current) => {
        const next = { ...current };
        delete next[editingItem.id];
        return next;
      });
      select(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update. Your edit is kept.");
      throw failure;
    } finally {
      setUpdating(false);
    }
  };
  const selectionKey = editingItem?.id ?? "draft";
  return {
    initialSelection: selections[selectionKey],
    changeSelection: (selection: PromptSelectionSnapshot) =>
      setSelections((current) => ({ ...current, [selectionKey]: selection })),
    draftValue: defaultValue,
    change,
    changeState,
    edit: (item: QueuedFollowUp) => {
      if (!updating) select(item);
    },
    selectDraft: () => {
      if (!updating) select(null);
    },
    discard,
    editingItem,
    editingItemId: editingItem?.id ?? null,
    focusSignal,
    inputValue,
    editorState,
    isEditing: Boolean(editingItem),
    submit,
    error,
    notice: notice ?? (createNew ? "This request was sent. Create a new queue item to keep your edits." : null),
    createNew,
    updating,
    stale,
    dirtyItemIds: Object.keys(edits).filter(
      (id) => edits[id].text !== queuedFollowUps.find((item) => item.id === id)?.prompt,
    ),
  };
};
