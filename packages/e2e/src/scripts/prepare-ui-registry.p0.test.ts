import { expect, test } from "bun:test";
import { createServer, type Server } from "node:net";
import { prepareUiRegistry } from "./prepare-ui-registry";

const listen = (server: Server, port: number) =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No listening address"));
      resolve(address.port);
    });
  });
const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    if (!server.listening) return resolve();
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("registry preparation cannot allocate the UI runtime's selected address", async () => {
  const selected = createServer();
  const contender = createServer();
  const runtime = createServer();
  const port = await listen(selected, 0);
  await close(selected);
  try {
    await prepareUiRegistry(`http://127.0.0.1:${port}`, async () => {
      // Force the port-zero allocator's supported choice of the now-free UI address.
      await expect(listen(contender, port)).rejects.toMatchObject({ code: "EADDRINUSE" });
      return "registry prepared";
    });
    expect(await listen(runtime, port)).toBe(port);
  } finally {
    await Promise.all([close(contender), close(runtime)]);
  }
});

test("failed registry preparation releases the UI address and preserves the failure", async () => {
  const selected = createServer();
  const runtime = createServer();
  const port = await listen(selected, 0);
  await close(selected);
  const failure = new Error("Package preparation failed");
  try {
    await expect(
      prepareUiRegistry(`http://127.0.0.1:${port}`, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await listen(runtime, port)).toBe(port);
  } finally {
    await close(runtime);
  }
});

test("an occupied UI address stops preparation without closing its owner's listener", async () => {
  const owner = createServer();
  const port = await listen(owner, 0);
  let prepared = false;
  try {
    await expect(
      prepareUiRegistry(`http://127.0.0.1:${port}`, async () => {
        prepared = true;
      }),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(prepared).toBe(false);
    expect(owner.listening).toBe(true);
  } finally {
    await close(owner);
  }
});
