import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAcceptedRevision, stopExtensionPreparation } from "pstdio-extensions";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { createRuntimeCandidateInspection } from "./runtime-candidate-inspection";
import { createTestSkillExtensionSource } from "./test-utils/create-test-extension-source";

test("a later edit supersedes stalled candidate evaluation and completed content is not inspected again", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-candidate-owner-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = createTestSkillExtensionSource({
    root,
    name: "candidate-owner",
    installName: "candidate-owner",
    displayName: "Candidate owner",
  });
  const accepted = await loadExtensionSource(source, { accepted: true });
  const entered = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const release = Promise.withResolvers<void>();
  let evaluations = 0;
  const errors: unknown[] = [];
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      evaluations++;
      entered[Number(new URL(request.url).searchParams.get("version"))]!.resolve();
      await release.promise;
      return new Response("continue");
    },
  });
  const inspector = createRuntimeCandidateInspection({
    acceptedId: async () => accepted.preparedRevision!.id,
    onError: (error) => errors.push(error),
  });
  const work: Promise<void>[] = [];
  try {
    await inspector.inspect(source);
    expect(evaluations).toBe(0);
    const entry = join(source, "extension.ts");
    const definition = readFileSync(entry, "utf8");
    writeFileSync(entry, `await fetch(${JSON.stringify(`${gate.url.href}?version=0`)});\n${definition}`);
    work.push(inspector.inspect(source));
    await entered[0]!.promise;
    writeFileSync(entry, `await fetch(${JSON.stringify(`${gate.url.href}?version=1`)});\n${definition}`);
    work.push(inspector.inspect(source));
    expect(
      await Promise.race([entered[1]!.promise.then(() => "superseded"), Bun.sleep(1000).then(() => "stalled")]),
    ).toBe("superseded");
    expect((await readAcceptedRevision(source))?.id).toBe(accepted.preparedRevision!.id);
    release.resolve();
    await Promise.all(work);
    await inspector.inspect(source);
    expect(evaluations).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    release.resolve();
    await inspector.dispose();
    await Promise.allSettled(work);
    await stopExtensionPreparation();
    await gate.stop(true);
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  }
});

test("background inspection detects dependency-only replacement without adopting it", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-candidate-dependency-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = createTestSkillExtensionSource({
    root,
    name: "dependency-owner",
    installName: "dependency-owner",
    displayName: "Dependency owner",
  });
  const manifestPath = join(source, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.dependencies = { "candidate-dependency": "1.0.0" };
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const dependency = join(source, "node_modules", "candidate-dependency");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "candidate-dependency", version: "1.0.0", type: "module", main: "index.js" }),
  );
  const dependencyEntry = join(dependency, "index.js");
  writeFileSync(dependencyEntry, "export const value = 1;");
  const entry = join(source, "extension.ts");
  writeFileSync(entry, `import "candidate-dependency";\n${readFileSync(entry, "utf8")}`);
  const accepted = await loadExtensionSource(source, { accepted: true });
  const baseline = hashExtensionSource(source);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async () => {
      evaluations++;
      entered.resolve();
      await release.promise;
      return new Response("continue");
    },
  });
  const errors: unknown[] = [];
  let evaluations = 0;
  const inspector = createRuntimeCandidateInspection({
    acceptedId: async () => accepted.preparedRevision!.id,
    onError: (error) => errors.push(error),
  });
  let work: Promise<void> | undefined;
  try {
    writeFileSync(dependencyEntry, `await fetch(${JSON.stringify(gate.url.href)}); export const value = 2;`);
    expect(hashExtensionSource(source)).toBe(baseline);
    work = inspector.inspect(source);
    expect(await Promise.race([entered.promise.then(() => "inspected"), work.then(() => "skipped")])).toBe("inspected");
    expect((await readAcceptedRevision(source))?.id).toBe(accepted.preparedRevision!.id);
    release.resolve();
    await work;
    await inspector.inspect(source);
    expect(evaluations).toBe(1);
    writeFileSync(dependencyEntry, `await fetch(${JSON.stringify(gate.url.href)}); export const value = 3;`);
    expect(hashExtensionSource(source)).toBe(baseline);
    await inspector.inspect(source);
    expect(evaluations).toBe(2);
    expect((await readAcceptedRevision(source))?.id).toBe(accepted.preparedRevision!.id);
    expect(errors).toEqual([]);
  } finally {
    release.resolve();
    await inspector.dispose();
    await work;
    await stopExtensionPreparation();
    await gate.stop(true);
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  }
});
