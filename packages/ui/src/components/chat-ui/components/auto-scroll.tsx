import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import type { SessionMessage } from "./message-types";

export interface AutoScrollProps {
  /** Displayed messages; a new message, part or text while away means there is something new to read. */
  messages: SessionMessage[];
  conversationKey?: string | null;
  /** Whether the reader is viewing this conversation. Defaults to true. */
  reading?: boolean;
}

export interface ReaderReturnState {
  reading: boolean;
  /** The latest content the reader has seen. */
  seenTail: string | null;
  /** The reader just came back; a newer tail may still arrive while the conversation catches up. */
  returning: boolean;
}

/** How long a returning reader waits for a conversation to catch up before new content stops moving them. */
export const READER_RETURN_CATCH_UP_MS = 3_000;

/** Returning readers land on the latest reply only when it changed while they were away. */
export const getNextReaderReturnState = (state: ReaderReturnState, reading: boolean, tail: string | null) => {
  if (!reading) return { shouldScroll: false, state: { reading, seenTail: state.seenTail, returning: false } };
  const returning = state.returning || !state.reading;
  if (!returning) return { shouldScroll: false, state: { reading, seenTail: tail, returning: false } };
  const shouldScroll = tail !== state.seenTail;
  return { shouldScroll, state: { reading, seenTail: tail, returning: !shouldScroll } };
};

const tailIdentity = (latest: SessionMessage | undefined) => {
  if (!latest) return null;
  const part = latest.parts.at(-1);
  const size = part && "text" in part && typeof part.text === "string" ? part.text.length : 0;
  return `${latest.id}:${latest.parts.length}:${size}`;
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
  const { conversationKey, messages, reading = true } = props;
  const userMessageCount = messages.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0);
  const tail = tailIdentity(messages.at(-1));
  const { scrollToBottom } = useStickToBottomContext();
  const readerRef = useRef<ReaderReturnState>({ reading, seenTail: tail, returning: false });

  useEffect(() => {
    const next = getNextReaderReturnState(readerRef.current, reading, tail);
    readerRef.current = next.state;
    if (next.shouldScroll) scrollToBottom("instant");
  }, [reading, tail, scrollToBottom]);

  useEffect(() => {
    if (!reading) return;
    // A hidden conversation stops observing; its refreshed transcript arrives shortly after the reader returns.
    const timer = setTimeout(() => {
      readerRef.current = { ...readerRef.current, returning: false };
    }, READER_RETURN_CATCH_UP_MS);
    return () => clearTimeout(timer);
  }, [reading]);
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
