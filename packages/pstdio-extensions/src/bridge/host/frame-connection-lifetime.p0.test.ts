import { expect, test } from "bun:test";
import { createFrameConnectionLifetime } from "./frame-connection-lifetime";

test("effect cleanup retains a live browsing context and closes it after removal", async () => {
  let current = true;
  const transport = new AbortController();
  const lifetime = createFrameConnectionLifetime(() => current);
  expect(lifetime.attach({ close: () => transport.abort() })).toBe(true);

  lifetime.releaseIfDetached();
  await Promise.resolve();
  expect(transport.signal.aborted).toBe(false);

  current = false;
  lifetime.releaseIfDetached();
  await Promise.resolve();
  expect(transport.signal.aborted).toBe(true);
});

test("a handshake completing after removal closes without admitting the connection", async () => {
  const transport = new AbortController();
  const lifetime = createFrameConnectionLifetime(() => false);
  lifetime.releaseIfDetached();
  await Promise.resolve();

  expect(lifetime.attach({ close: () => transport.abort() })).toBe(false);
  expect(transport.signal.aborted).toBe(true);
});
