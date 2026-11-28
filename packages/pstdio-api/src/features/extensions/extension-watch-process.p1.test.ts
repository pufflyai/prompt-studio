import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopExtensionPreparation } from "pstdio-extensions";
import { hashExtensionSourceAsync } from "./extension-preparation";
import { createExtensionWatchProcess } from "./extension-watch-process";

test("the watch process reconciles existing sources and reports later filesystem edits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-watch-process-"));
  const process = createExtensionWatchProcess();
  const source = join(directory, "tool");
  const attached = Promise.withResolvers<string>();
  const changed = Promise.withResolvers<string>();
  process.subscribe((event) => {
    if (event.sourcePath !== source || typeof event.sourceHash !== "string") return;
    if (event.attachment) attached.resolve(event.sourceHash);
    else changed.resolve(event.sourceHash);
  });
  try {
    await mkdir(source);
    await writeFile(join(source, "package.json"), '{"name":"tool"}');
    await process.run({
      task: "watch.update",
      input: {
        kind: "sources",
        id: "sources",
        sourcePaths: [],
        reconcileAll: true,
        rows: [{ install_name: "tool", source_path: source }],
      },
    });
    const original = await attached.promise;
    // Bun's native attachment can return before its macOS event stream starts.
    await Bun.sleep(150);
    await writeFile(join(source, "package.json"), '{"name":"tool","version":"0.1.0"}');
    expect(await changed.promise).not.toBe(original);
  } finally {
    await process.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("extension preparation and shutdown complete while watcher registration is stalled", async () => {
  const source = await mkdtemp(join(tmpdir(), "pstdio-watch-stall-"));
  const watch = createExtensionWatchProcess([
    process.execPath,
    "-e",
    'process.on("message", () => process.send({event: {kind: "registration-entered"}}));',
  ]);
  const entered = Promise.withResolvers<void>();
  watch.subscribe((event) => {
    if (event.kind === "registration-entered") entered.resolve();
  });
  const registration = watch.run({ task: "watch.update", input: { kind: "roots", id: "roots", rows: [] } });
  const failure = registration.catch((error: unknown) => error);
  try {
    await entered.promise;
    await writeFile(join(source, "package.json"), '{"name":"tool"}');
    expect(await hashExtensionSourceAsync(source)).not.toBe("");
    await watch.stop();
    expect(await failure).toMatchObject({ message: "Extension watch process stopped." });
  } finally {
    await watch.stop();
    await stopExtensionPreparation();
    await rm(source, { recursive: true, force: true });
  }
});
