import { createContext, useContext, useState } from "react";
import { getQuestionRequestKey, resolveQuestionPrompt } from "../tool-rendering/question-prompt";
import type { SessionMessage, ToolPart } from "./message-types";

interface QuestionSelection {
  conversationKey?: string;
  key: string;
  index: number;
  revision: number;
}

interface QuestionNavigation {
  activeKey?: string;
  selection?: QuestionSelection;
  open: (part: ToolPart, index: number) => void;
  selectStep: (index: number) => void;
  close: () => void;
}

export const ChatQuestionNavigationContext = createContext<QuestionNavigation | undefined>(undefined);
export const useQuestionNavigation = () => useContext(ChatQuestionNavigationContext);

export const useChatQuestionNavigation = (messages: SessionMessage[], conversationKey?: string) => {
  const [selection, setSelection] = useState<QuestionSelection>();
  const current = selection?.conversationKey === conversationKey ? selection : undefined;
  const prompt = current ? resolveQuestionPrompt(messages, current.key) : undefined;
  return {
    prompt,
    value: {
      activeKey: prompt ? current?.key : undefined,
      selection: prompt ? current : undefined,
      open: (part: ToolPart, index: number) =>
        setSelection((previous) => ({
          conversationKey,
          key: getQuestionRequestKey(part),
          index,
          revision: (previous?.revision ?? 0) + 1,
        })),
      selectStep: (index) => setSelection((previous) => (previous ? { ...previous, index } : undefined)),
      close: () => setSelection(undefined),
    } satisfies QuestionNavigation,
  };
};
