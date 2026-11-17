import { expect, test } from "bun:test";
import { createChatFiniteRead } from "./chat-finite-read";

test("chat initialization awaits the latest observation started by a snapshot callback", async () => {
  const requests: ReturnType<typeof Promise.withResolvers<unknown>>[] = [];
  let loaded = false;
  let issued = 0;
  let replacement: Promise<void> | undefined;
  let replacementSettled = false;
  const finite = createChatFiniteRead({
    read: () => {
      const pending = Promise.withResolvers<unknown>();
      requests.push(pending);
      return pending.promise;
    },
    issue: () => ++issued,
    merge: () => {
      loaded = true;
    },
    loaded: () => loaded,
    publish: () => {
      if (!loaded || replacement) return;
      replacement = Promise.resolve();
      finite.query.invalidate();
      replacement = finite.observe().then(() => {
        replacementSettled = true;
      });
    },
  });
  const initial = finite.observe();
  try {
    requests[0].resolve({ messages: [] });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(requests).toHaveLength(2);
    expect(replacementSettled).toBe(false);
    requests[1].resolve({ messages: [] });
    await replacement;
    expect(replacementSettled).toBe(true);
  } finally {
    finite.stop();
    finite.dispose();
    for (const request of requests) request.resolve({ messages: [] });
    await initial;
    await replacement;
  }
});
