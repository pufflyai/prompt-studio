import { expect, test } from "bun:test";
import type { SessionHookDeps } from "../features/hooks/session-hooks";
import { createSessionLifecycleCallbacks } from "./session-lifecycle-callbacks";

test("closing session hooks drains admitted reads and stops further dispatch", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<null>();
  let reads = 0;
  const deps = {
    workspaceSessionService: {
      getWorkspaceBySessionId: async () => {
        reads++;
        entered.resolve();
        return release.promise;
      },
    },
  } as unknown as SessionHookDeps;
  const hooks = createSessionLifecycleCallbacks(() => deps);
  const session = { id: "session", project_id: "project", status: "completed" };
  hooks.onSessionStarted(session);
  await entered.promise;
  let closed = false;
  const closing = hooks.close().then(() => {
    closed = true;
  });
  await Bun.sleep(0);
  expect(closed).toBe(false);
  hooks.onSessionResumed(session);
  release.resolve(null);
  await closing;
  hooks.onSessionStatusChanged(session);
  await hooks.close();
  expect(reads).toBe(1);
});

test("closing session hooks cancels workspace readiness polling", async () => {
  const entered = Promise.withResolvers<void>();
  let reads = 0;
  const deps = {
    workspaceSessionService: {
      getWorkspaceBySessionId: async () => {
        reads++;
        entered.resolve();
        return { initializing: true };
      },
    },
  } as unknown as SessionHookDeps;
  const hooks = createSessionLifecycleCallbacks(() => deps);
  hooks.onSessionStarted({ id: "session", project_id: "project", status: "in_progress" });
  await entered.promise;
  await hooks.close();
  expect(reads).toBe(1);
});
