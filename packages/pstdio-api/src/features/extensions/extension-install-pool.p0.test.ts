import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { stopExtensionPreparation } from "pstdio-extensions";
import { createPreparationClient, extensionUpgradeConcurrency } from "pstdio-extensions/preparation-client";
import { createExtensionInstallBatch } from "./extension-install-batch";
import { extensionInstallResources } from "./extension-install-resources";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension } from "./install-extension-source-test-fixtures";

const roots: string[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
const clients: ReturnType<typeof createPreparationClient>[] = [];
afterEach(async () => {
  await stopExtensionPreparation();
  for (const client of clients.splice(0)) await client.stop();
  for (const server of servers.splice(0)) await server.stop(true);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const root = () => {
  const path = mkdtempSync(join(tmpdir(), "extension-install-pool-"));
  roots.push(path);
  return path;
};
const gate = () => {
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async () => {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  servers.push(server);
  return { entered, release, url: server.url.href };
};

test("the production pool admits independent installs up to the host capacity", async () => {
  const directory = root();
  const gates = Array.from({ length: extensionUpgradeConcurrency + 1 }, gate);
  const inputs = gates.map((g, index) => {
    const source = join(directory, `source-${index}`);
    makeExtension(source, { namespace: `tool-${index}` });
    const entry = join(source, "extension.ts");
    writeFileSync(entry, `await fetch(${JSON.stringify(g.url)});\n${readFileSync(entry, "utf8")}`);
    return {
      source,
      installName: `tool-${index}`,
      skipInstall: true,
      env: { ...process.env, PSTDIO_HOME: join(directory, "home") },
    };
  });
  const jobs = inputs.slice(0, -1).map((input) => installExtensionSource(input));
  try {
    await Promise.all(gates.slice(0, -1).map((g) => g.entered.promise));
    jobs.push(installExtensionSource(inputs.at(-1)!));
    const waiting = gates.at(-1)!;
    expect(await Promise.race([waiting.entered.promise.then(() => true), Bun.sleep(50).then(() => false)])).toBe(false);
    gates[0]!.release.resolve();
    await waiting.entered.promise;
    for (const g of gates) g.release.resolve();
    expect((await Promise.all(jobs)).map((result) => result.installName)).toEqual(
      inputs.map((input) => input.installName),
    );
  } finally {
    for (const g of gates) g.release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("recovery preserves a live peer's stages and intents then cleans them after retirement", async () => {
  const directory = root(),
    blocked = gate(),
    controller = new AbortController();
  const client = createPreparationClient(
    () => new Worker(new URL("./preparation-pool-recovery.fixture.ts", import.meta.url)),
    undefined,
    { workers: 2 },
  );
  clients.push(client);
  const input = { root: directory, url: blocked.url };
  const options = { home: join(directory, "home") };
  const held = client
    .run("hold", input, { ...options, resources: ["held"], signal: controller.signal })
    .catch((error) => error);
  try {
    await blocked.entered.promise;
    expect(await client.run("recover", input, { ...options, resources: ["recovery"] })).toEqual({
      stage: true,
      install: true,
    });
    controller.abort(new Error("Retire owner"));
    await held;
    // Exclusive recovery waits for both worker and child retirement to finish.
    expect(await client.run("recover", input, options)).toEqual({ stage: false, install: false });
  } finally {
    blocked.release.resolve();
    await held;
  }
});

test("unresolved targets stay exclusive and escaping aliases share a reservation", () => {
  expect(extensionInstallResources({ source: "./unknown" })).toBeUndefined();
  const a = extensionInstallResources({ source: "con.tool", installName: "con.tool" })!;
  const b = extensionInstallResources({ source: "_con.tool", installName: "_con.tool" })!;
  expect(a.some((key) => b.includes(key))).toBe(true);
  expect(extensionInstallResources({ source: "foo.", installName: "foo." })).toBeUndefined();
});

for (const symlink of [false, true]) {
  test(`an install cannot replace a peer's ${symlink ? "symlinked" : "direct"} source ancestor`, async () => {
    const directory = root(),
      a = gate(),
      b = gate();
    const home = join(directory, "home"),
      target = join(home, "extensions", "target");
    const actual = symlink ? join(directory, "external") : target;
    makeExtension(actual, { namespace: "first" });
    let source = actual;
    if (symlink) {
      mkdirSync(target, { recursive: true });
      source = join(target, "linked");
      symlinkSync(actual, source, "junction");
    }
    const second = join(directory, "second");
    makeExtension(second, { namespace: "second" });
    for (const [path, url] of [
      [actual, a.url],
      [second, b.url],
    ]) {
      const entry = join(path!, "extension.ts");
      writeFileSync(entry, `await fetch(${JSON.stringify(url)});\n${readFileSync(entry, "utf8")}`);
    }
    const options = { skipInstall: true, env: { ...process.env, PSTDIO_HOME: home } };
    const first = installExtensionSource({ ...options, source, installName: "copy" });
    await a.entered.promise;
    const replacement = installExtensionSource({ ...options, source: second, installName: "target", force: true });
    try {
      expect(await Promise.race([b.entered.promise.then(() => "started"), Bun.sleep(50).then(() => "held")])).toBe(
        "held",
      );
      a.release.resolve();
      await first;
      await b.entered.promise;
      b.release.resolve();
      await replacement;
    } finally {
      a.release.resolve();
      b.release.resolve();
      await Promise.allSettled([first, replacement]);
    }
  });
}

for (const batch of [false, true]) {
  test(`renamed installs serialize custom aliases at their existing destination (${batch ? "batch" : "pool"})`, async () => {
    const directory = root(),
      a = gate(),
      b = gate();
    const home = join(directory, "home"),
      target = join(home, "extensions", "pstdio-notes");
    makeExtension(target, { publisher: "pstdio", namespace: "pstdio-notes" });
    const inputs = [a, b].map((g, index) => {
      const source = join(directory, `renamed-${index}`);
      makeExtension(source, { publisher: "pstdio", namespace: index === 0 ? "pstdio-notes" : "notes" });
      const entry = join(source, "extension.ts");
      writeFileSync(entry, `await fetch(${JSON.stringify(g.url)});\n${readFileSync(entry, "utf8")}`);
      return {
        source,
        installName: `custom-${index}`,
        skipInstall: true,
        force: true,
        env: { ...process.env, PSTDIO_HOME: home },
      };
    });
    const install = batch ? createExtensionInstallBatch(inputs.length) : installExtensionSource;
    const jobs = inputs.map((input) => install(input));
    try {
      const first = await Promise.race([a.entered.promise.then(() => 0), b.entered.promise.then(() => 1)]);
      const gates = [a, b];
      const other = 1 - first;
      expect(
        await Promise.race([gates[other]!.entered.promise.then(() => "started"), Bun.sleep(50).then(() => "held")]),
      ).toBe("held");
      gates[first]!.release.resolve();
      await gates[other]!.entered.promise;
      gates[other]!.release.resolve();
      expect((await Promise.all(jobs)).map((result) => result.targetPath)).toEqual([target, target]);
      expect(JSON.parse(readFileSync(join(target, "package.json"), "utf8")).name).toBe(
        other === 0 ? "pstdio-notes" : "notes",
      );
    } finally {
      a.release.resolve();
      b.release.resolve();
      await Promise.allSettled(jobs);
    }
  });
}
