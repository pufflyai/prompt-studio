import { useEffect, useRef } from "react";
import type { PromptEditorRef } from "../../rich-text";
import { MAX_RECENT_USER_PROMPTS, movePromptHistory } from "./chat-input-history";

interface ChatInputHistoryOptions {
  recentUserMessages: string[];
  text: string;
  blocked: boolean;
  resetKey: string;
  onChange: (text: string) => void;
}

export const useChatInputHistory = (options: ChatInputHistoryOptions) => {
  const { recentUserMessages, text, blocked, resetKey, onChange } = options;
  const editorRef = useRef<PromptEditorRef>(null);
  const historyIndex = useRef<number | null>(null);
  const prompts = recentUserMessages.slice(0, MAX_RECENT_USER_PROMPTS);
  const signature = JSON.stringify(prompts);
  const resetSignature = JSON.stringify([signature, resetKey, blocked]);
  const previousResetSignature = useRef(resetSignature);
  useEffect(() => {
    if (previousResetSignature.current === resetSignature) return;
    previousResetSignature.current = resetSignature;
    historyIndex.current = null;
  }, [resetSignature]);

  const reset = () => {
    historyIndex.current = null;
  };
  const change = (value: string) => {
    if (historyIndex.current !== null && value !== prompts[historyIndex.current]) reset();
    onChange(value);
  };
  const recall = (direction: "previous" | "next") => {
    if (blocked) return false;
    const movement = movePromptHistory(historyIndex.current, direction, text, prompts.length);
    if (!movement) return false;
    historyIndex.current = movement.index;
    const value = movement.index === null ? "" : prompts[movement.index];
    editorRef.current?.setEditorValue(value);
    onChange(value);
    return true;
  };
  return { editorRef, reset, change, recallPrevious: () => recall("previous"), recallNext: () => recall("next") };
};
