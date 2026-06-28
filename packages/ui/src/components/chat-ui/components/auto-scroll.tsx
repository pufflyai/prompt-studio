import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

export interface AutoScrollProps {
  userMessageCount: number;
  conversationKey?: string | null;
}

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
  const { conversationKey, userMessageCount } = props;
  const { scrollToBottom } = useStickToBottomContext();
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
