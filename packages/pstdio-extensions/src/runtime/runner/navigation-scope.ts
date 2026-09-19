import type { NavigationTarget } from "@pstdio/sdk/extensions";

interface Frame {
  accepted: boolean;
  parent?: Frame;
}
export interface NavigationScope {
  open(target: NavigationTarget): void;
  fork(): NavigationScope;
  complete(accepted: boolean): void;
  collect(): NavigationTarget[];
}

/** Record at request time; a failed frame also invalidates its descendants. */
export const createNavigationScope = () => {
  const requests: { target: NavigationTarget; frame: Frame }[] = [];
  const accepted = (frame: Frame): boolean => frame.accepted && (!frame.parent || accepted(frame.parent));
  const scope = (parent?: Frame): NavigationScope => {
    const frame: Frame = { accepted: false, parent };
    return {
      open: (target) => {
        requests.push({ target, frame });
      },
      fork: () => scope(frame),
      complete: (success) => {
        frame.accepted = success;
      },
      collect: () => requests.filter((request) => accepted(request.frame)).map((request) => request.target),
    };
  };
  return scope();
};
