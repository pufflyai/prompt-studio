import { expect, type Matchers } from "bun:test";

type RejectionMatchers = {
  [M in keyof Matchers]: Matchers[M] extends (...args: infer A) => unknown ? (...args: A) => Promise<void> : never;
};

/**
 * Use instead of `expect(promise).rejects`: while Bun 1.4.4's `.rejects` waits it can deliver no Worker
 * or IPC messages (seen on Windows), so a rejection that needs a backend worker round trip hangs.
 * This awaits the rejection first, then applies the matcher; `toThrow*` sees a function that throws it.
 * `.resolves` has the same problem, so tests write `expect(await promise)` instead.
 */
export const expectRejection = (promise: PromiseLike<unknown>) => {
  const rejection = Promise.resolve(promise).then(
    (value) => {
      throw new Error(`Expected the promise to reject, but it resolved with ${Bun.inspect(value)}`);
    },
    (error: unknown) => error,
  );
  return new Proxy({} as RejectionMatchers, {
    get:
      (_, matcher: string) =>
      async (...args: unknown[]) => {
        const error = await rejection;
        const subject = matcher.startsWith("toThrow")
          ? () => {
              throw error;
            }
          : error;
        (expect(subject) as unknown as Record<string, (...args: unknown[]) => void>)[matcher]!(...args);
      },
  });
};
