import { expect, test } from "bun:test";
import { createDeviceCommandPolling } from "./packaged-device-command-polling";

test("a deadline names the phase even while a polling read is held", async () => {
  const polling = createDeviceCommandPolling(Date.now() + 50);
  let reading = false;
  const result = polling
    .waitFor("remote history", () => {
      reading = true;
      return new Promise(() => {});
    })
    .then(
      () => "completed",
      (error: Error) => error.message,
    );
  try {
    expect(reading).toBe(true);
    expect(await Promise.race([result, Bun.sleep(150).then(() => "still pending")])).toBe(
      "Timed out waiting for remote history",
    );
  } finally {
    polling.close();
  }
});

test("owned cleanup cancels the pending HTTP read and settles its poll", async () => {
  const entered = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      entered.resolve();
      request.signal.addEventListener("abort", () => cancelled.resolve(), { once: true });
      return new Promise<Response>(() => {});
    },
  });
  const polling = createDeviceCommandPolling(Date.now() + 4_000);
  const result = polling
    .waitFor("remote session", async () => (await polling.fetch(server.url)).ok)
    .then(
      () => "completed",
      () => "cancelled",
    );
  try {
    await entered.promise;
    polling.close();
    expect(await result).toBe("cancelled");
    await cancelled.promise;
  } finally {
    polling.close();
    await server.stop(true);
  }
});
