import { useRef } from "react";

export interface MessageAnimationState {
  initialized: boolean;
  seenKeys: Set<string>;
}

interface NextMessageAnimationStateArgs {
  itemKeys: string[];
  state: MessageAnimationState;
}

export const messageFadeInProps = {
  animationName: "message-fade-in",
  animationDuration: "200ms",
  animationTimingFunction: "ease-out",
} as const;

export const getNextMessageAnimationState = (args: NextMessageAnimationStateArgs) => {
  const animatedKeys = new Set<string>();
  const seenKeys = new Set(args.state.seenKeys);

  for (const key of args.itemKeys) {
    if (args.state.initialized && !seenKeys.has(key)) {
      animatedKeys.add(key);
    }

    seenKeys.add(key);
  }

  return {
    animatedKeys,
    state: {
      initialized: true,
      seenKeys,
    },
  };
};

export const useMessageAnimationKeys = (itemKeys: string[]) => {
  const stateRef = useRef<MessageAnimationState>({
    initialized: false,
    seenKeys: new Set(),
  });
  const next = getNextMessageAnimationState({
    itemKeys,
    state: stateRef.current,
  });

  stateRef.current = next.state;

  return next.animatedKeys;
};
