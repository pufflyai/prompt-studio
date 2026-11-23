import { setTimeout } from "node:timers/promises";
import type { AccessSession } from "./config";

export async function supervise(input: {
  signal: AbortSignal;
  session: () => Promise<AccessSession>;
  apply: (session: AccessSession) => Promise<void>;
  clear: () => Promise<void>;
  warn: (message: string) => void;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}) {
  const now = input.now ?? Date.now;
  const wait = input.wait ?? ((ms) => setTimeout(ms, undefined, { signal: input.signal }));
  let expiresAt = 0;
  let failures = 0;
  try {
    while (!input.signal.aborted) {
      let delay: number;
      try {
        const session = await input.session();
        if (Date.parse(session.expiresAt) <= now() || Date.parse(session.renewAt) >= Date.parse(session.expiresAt))
          throw new Error("Invalid session lifetime.");
        // Partial configuration must not leave credentials installed beyond the known expiry.
        expiresAt = Math.min(expiresAt || Infinity, Date.parse(session.expiresAt));
        await input.apply(session);
        expiresAt = Date.parse(session.expiresAt);
        failures = 0;
        delay = Math.max(1000, Date.parse(session.renewAt) - now());
      } catch {
        failures++;
        input.warn("Cloud access could not be renewed. Check sign-in, run authorization and service availability.");
        if (expiresAt && now() >= expiresAt) {
          await input.clear();
          return;
        }
        // Initial enrollment failure is actionable; do not run forever without a connection.
        if (!expiresAt) throw new Error("Cloud enrollment failed.");
        delay = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5), expiresAt - now());
      }
      await wait(delay);
    }
  } catch (error) {
    if (!input.signal.aborted) throw error;
  }
  // A VM/user service stopping must not leave renewable credentials behind.
  if (expiresAt) await input.clear();
}
