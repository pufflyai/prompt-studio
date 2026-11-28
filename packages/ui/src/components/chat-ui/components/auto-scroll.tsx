import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import type { SessionMessage } from "./message-types";

export interface AutoScrollProps {
  userMessageCount: number;
  conversationKey?: string | null;
  /** Whether the reader is viewing this conversation. */
  reading?: boolean;
  /** Latest displayed message; a new message or part while away means there is something new to read. */
  latest?: Pick<SessionMessage, "id" | "parts">;
}

export interface ReaderReturnState {
  reading: boolean;
  /** The latest content the reader has seen. */
  seenTail: string | null;
}

/** Returning readers land on the latest reply only when it changed while they were away. */
export const getNextReaderReturnState = (state: ReaderReturnState, reading: boolean, tail: string | null) => {
  if (!reading) return { shouldScroll: false, state: { reading, seenTail: state.seenTail } };
  return { shouldScroll: !state.reading && tail !== state.seenTail, state: { reading, seenTail: tail } };
};

interface ShouldAutoScrollArgs {
  previousUserMessageCount: number;
  userMessageCount: number;
}

export interface AutoScrollState {
  conversationKey: string | null;
  userMessageCount: number;
}

interface NextAutoScrollStateArgs {
  state: AutoScrollState;
  conversationKey?: string | null;
  userMessageCount: number;
}

interface ScrollForNextAutoScrollStateArgs extends NextAutoScrollStateArgs {
  scrollToBottom: (animation?: "instant") => void;
}

export const shouldAutoScroll = (args: ShouldAutoScrollArgs) => {
  const { previousUserMessageCount, userMessageCount } = args;

  if (previousUserMessageCount === 0) {
    return false;
  }

  return userMessageCount > previousUserMessageCount;
};

export const getNextAutoScrollState = (args: NextAutoScrollStateArgs) => {
  const conversationKey = args.conversationKey ?? null;

  if (args.state.conversationKey !== conversationKey) {
    return {
      shouldScroll: false,
      state: {
        conversationKey,
        userMessageCount: args.userMessageCount,
      },
    };
  }

  return {
    shouldScroll: shouldAutoScroll({
      previousUserMessageCount: args.state.userMessageCount,
      userMessageCount: args.userMessageCount,
    }),
    state: {
      conversationKey,
      userMessageCount: Math.max(args.state.userMessageCount, args.userMessageCount),
    },
  };
};

export const scrollForNextAutoScrollState = (args: ScrollForNextAutoScrollStateArgs) => {
  const next = getNextAutoScrollState(args);

  if (next.shouldScroll) {
    args.scrollToBottom("instant");
  }

  return next;
};

export function AutoScroll(props: AutoScrollProps) {
  const { conversationKey, userMessageCount, reading = true, latest } = props;
  const tail = latest ? `${latest.id}:${latest.parts.length}` : null;
  const { scrollToBottom } = useStickToBottomContext();
  const readerRef = useRef<ReaderReturnState>({ reading, seenTail: tail });

  useEffect(() => {
    const next = getNextReaderReturnState(readerRef.current, reading, tail);
    readerRef.current = next.state;
    if (next.shouldScroll) scrollToBottom("instant");
  }, [reading, tail, scrollToBottom]);
  const stateRef = useRef<AutoScrollState>({
    conversationKey: conversationKey ?? null,
    userMessageCount,
  });

  useEffect(() => {
    const next = scrollForNextAutoScrollState({
      state: stateRef.current,
      conversationKey,
      userMessageCount,
      scrollToBottom,
    });

    stateRef.current = next.state;
  }, [conversationKey, userMessageCount, scrollToBottom]);

  return null;
}
