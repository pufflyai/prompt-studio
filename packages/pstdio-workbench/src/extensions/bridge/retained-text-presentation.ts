import type { TextEditingSession } from "@pstdio/sdk/extensions";
import type { NativeTextPresentation } from "./native-text-presentation";

/** Retained DOM can outlive admission. One queue owns release before any successor is constructed. */
export const createRetainedTextPresentation = (connect: () => NativeTextPresentation) => {
  let current: NativeTextPresentation | undefined;
  let admitted: TextEditingSession | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const run = <Value>(operation: () => Promise<Value>) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const replace = async () => {
    retry = replace;
    admitted = undefined;
    await current?.close();
    const next = connect();
    current = next;
    retry = async () => {
      admitted = await next.retry();
      return admitted;
    };
    admitted = await next.open();
    return admitted;
  };
  let retry = replace;
  return {
    owns: (session: TextEditingSession) => session === admitted,
    open: () => run(replace),
    retry: () => run(() => retry()),
    close: () =>
      run(async () => {
        admitted = undefined;
        await current?.close();
      }),
  };
};
