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

const itemKeysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
};

export const useMessageAnimationKeys = (itemKeys: string[]) => {
  const stateRef = useRef<MessageAnimationState>({
    initialized: false,
    seenKeys: new Set(),
  });
  // The hook mutates state during render, so React's duplicate renders (Strict
  // Mode, concurrent reconciliation) would otherwise consume the animation
  // flag on the second pass and leave the message non-animating. Cache the
  // last inputs to make repeated calls idempotent.
  const lastResultRef = useRef<{ itemKeys: string[]; animatedKeys: Set<string> } | null>(null);

  if (lastResultRef.current && itemKeysEqual(lastResultRef.current.itemKeys, itemKeys)) {
    return lastResultRef.current.animatedKeys;
  }

  const next = getNextMessageAnimationState({
    itemKeys,
    state: stateRef.current,
  });

  stateRef.current = next.state;
  lastResultRef.current = { itemKeys: [...itemKeys], animatedKeys: next.animatedKeys };

  return next.animatedKeys;
};
