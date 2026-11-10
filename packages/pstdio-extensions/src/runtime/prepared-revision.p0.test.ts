import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionPackage } from "./loader";
import { stopExtensionPreparation } from "./preparation-client";
import { acceptPreparedRevision, prepareExtensionRevision, readAcceptedRevision } from "./prepared-revision";

const roots: string[] = [];
const previousHome = process.env.PSTDIO_HOME;
afterEach(async () => {
  await stopExtensionPreparation();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-extension-"));
  roots.push(root);
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "source");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "prepared",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "value.txt"), "first");
  writeFileSync(
    join(source, "extension.ts"),
    `import { readFileSync } from "node:fs"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => readFileSync(new URL("./value.txt", import.meta.url), "utf8") }] };`,
  );
  return source;
};

test("accepted artifacts survive worker restart and offline source edits", async () => {
  const source = fixture();
  const prepared = await prepareExtensionRevision(source);
  await acceptPreparedRevision(source, prepared);
  await stopExtensionPreparation();
  writeFileSync(join(source, "value.txt"), "changed while closed");
  writeFileSync(join(source, "extension.ts"), "throw new Error('unaccepted source');");
  const accepted = await readAcceptedRevision(source);
  expect(accepted?.id).toBe(prepared.id);
  const diagnostics: never[] = [];
  const loaded = await loadExtensionPackage({ path: source }, diagnostics, { preparedRevision: accepted! });
  expect(diagnostics).toEqual([]);
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("first");
});

test("unchanged preparation shares artifacts and dependency byte changes invalidate them", async () => {
  const source = fixture();
  const dependency = join(source, "node_modules", "owned-dependency");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "owned-dependency", version: "1.0.0", main: "index.js" }),
  );
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { "owned-dependency": "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(dependency, "index.js"), 'export const value = "first";');
  writeFileSync(
    join(source, "extension.ts"),
    'import { value } from "owned-dependency"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value }] };',
  );
  const [first, concurrent] = await Promise.all([prepareExtensionRevision(source), prepareExtensionRevision(source)]);
  expect(first.id).toBe(concurrent.id);
  expect((await prepareExtensionRevision(source)).entryPath).toBe(first.entryPath);
  await acceptPreparedRevision(source, first);
  writeFileSync(join(dependency, "index.js"), 'export const value = "second";');
  const next = await prepareExtensionRevision(source);
  expect(next.id).not.toBe(first.id);
  expect((await readAcceptedRevision(source))?.id).toBe(first.id);
  const loaded = await loadExtensionPackage({ path: source }, [], { preparedRevision: next });
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("second");
});

test("missing artifacts invalidate only their accepted revision", async () => {
  const source = fixture();
  const first = await prepareExtensionRevision(source);
  await acceptPreparedRevision(source, first);
  rmSync(first.entryPath);
  expect(await readAcceptedRevision(source)).toBeNull();
  const repaired = await prepareExtensionRevision(source);
  expect(readFileSync(repaired.entryPath, "utf8").length).toBeGreaterThan(0);
});

test("dependencies selected by package exports keep their own dependency closure", async () => {
  const source = fixture();
  const parent = join(source, "node_modules", "parent-dependency");
  const leaf = join(source, "node_modules", "leaf-dependency");
  mkdirSync(parent, { recursive: true });
  mkdirSync(leaf);
  writeFileSync(
    join(parent, "package.json"),
    JSON.stringify({
      name: "parent-dependency",
      version: "1.0.0",
      main: "legacy.js",
      exports: "./actual.js",
      dependencies: { "leaf-dependency": "1.0.0" },
    }),
  );
  writeFileSync(join(parent, "legacy.js"), "export const value = 'legacy';");
  writeFileSync(join(parent, "actual.js"), "export { value } from 'leaf-dependency';");
  writeFileSync(
    join(leaf, "package.json"),
    JSON.stringify({ name: "leaf-dependency", version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(leaf, "index.js"), "export const value = 'export-selected';");
  writeFileSync(
    join(source, "extension.ts"),
    'import { value } from "parent-dependency"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value }] };',
  );
  const loaded = await loadExtensionPackage({ path: source }, []);
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("export-selected");
});

test("managed agent executables resolve from the immutable revision after dependency replacement", async () => {
  const source = fixture();
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { "managed-agent": "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  const dependency = join(source, "node_modules", "managed-agent");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "managed-agent", version: "1.0.0", main: "index.cjs" }),
  );
  writeFileSync(join(dependency, "index.cjs"), 'module.exports = "managed original";');
  writeFileSync(
    join(source, "extension.ts"),
    `import { createRequire } from "node:module"; const require = createRequire(import.meta.url); export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => require("managed-agent") }] };`,
  );
  const revision = await prepareExtensionRevision(source);
  rmSync(join(source, "node_modules"), { recursive: true });
  const loaded = await loadExtensionPackage({ path: source }, [], {
    preparedRevision: revision,
    immutableAssets: true,
  });
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("managed original");
});

for (const resolution of ["computed import", "package imports alias"])
  test(`accepted revisions retain dependencies reached through ${resolution}`, async () => {
    const source = fixture();
    const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
    manifest.dependencies = { "dynamic-dependency": "1.0.0" };
    if (resolution === "package imports alias")
      manifest.imports = { "#value/*": "./wrong/*.ts", "#value/specific/*": "./*.ts" };
    writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
    const dependency = join(source, "node_modules", "dynamic-dependency");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(
      join(dependency, "package.json"),
      JSON.stringify({ name: "dynamic-dependency", version: "1.0.0", main: "index.js" }),
    );
    writeFileSync(join(dependency, "index.js"), 'export const value = "retained";');
    writeFileSync(join(source, "alias.ts"), 'export { value } from "dynamic-dependency";');
    const implementation =
      resolution === "computed import"
        ? 'const name = "dynamic-dependency"; const read = async () => (await import(name)).value;'
        : 'import { value } from "#value/specific/alias"; const read = async () => value;';
    writeFileSync(
      join(source, "extension.ts"),
      `${implementation} export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: read }] };`,
    );
    const revision = await prepareExtensionRevision(source);
    rmSync(join(source, "node_modules"), { recursive: true });
    const loaded = await loadExtensionPackage({ path: source }, [], {
      preparedRevision: revision,
      immutableAssets: true,
    });
    expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("retained");
  });

test("dependency assets remain relative to their immutable dependency module", async () => {
  const source = fixture();
  const dependency = join(source, "node_modules", "asset-reader");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "asset-reader", version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(
    join(dependency, "index.js"),
    'import { readFileSync } from "node:fs"; export const read = () => readFileSync(new URL("./value.txt", import.meta.url), "utf8");',
  );
  writeFileSync(join(dependency, "value.txt"), "dependency asset");
  writeFileSync(
    join(source, "extension.ts"),
    'import { read } from "asset-reader"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => read() }] };',
  );
  const revision = await prepareExtensionRevision(source);
  rmSync(join(source, "node_modules"), { recursive: true });
  const loaded = await loadExtensionPackage({ path: source }, [], {
    preparedRevision: revision,
    immutableAssets: true,
  });
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("dependency asset");
});

for (const kind of ["alias", "absolute", "file URL", "extensionless", "directory"])
  test(`external compiler configuration and ${kind} assets are frozen with the accepted runtime`, async () => {
    const source = fixture();
    const root = join(source, "..");
    mkdirSync(join(root, "shared"));
    writeFileSync(
      join(root, "compiler.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@shared/*": ["./shared/*"] } } }),
    );
    writeFileSync(join(source, "tsconfig.json"), JSON.stringify({ extends: "../compiler.json" }));
    writeFileSync(join(root, "shared", "index.ts"), 'export { value } from "./helper";');
    writeFileSync(join(root, "shared", "value.txt"), "first external");
    writeFileSync(
      join(root, "shared", "helper.ts"),
      'import { readFileSync } from "node:fs"; export const value = () => readFileSync(new URL("./value.txt", import.meta.url), "utf8");',
    );
    const inputs = {
      alias: "@shared/helper",
      absolute: join(root, "shared", "helper.ts"),
      "file URL": pathToFileURL(join(root, "shared", "helper.ts")).href,
      extensionless: join(root, "shared", "helper"),
      directory: join(root, "shared"),
    };
    writeFileSync(
      join(source, "extension.ts"),
      `import { value } from ${JSON.stringify(inputs[kind as keyof typeof inputs])}; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value() }] };`,
    );
    const first = await prepareExtensionRevision(source);
    await acceptPreparedRevision(source, first);
    writeFileSync(join(root, "shared", "value.txt"), "second external");
    const next = await prepareExtensionRevision(source);
    expect(next.id).not.toBe(first.id);
    expect(next.loadKey).not.toBe(first.loadKey);
    const accepted = await loadExtensionPackage({ path: source }, [], { preparedRevision: first });
    expect(await accepted!.definition.commands![0].run({} as never, {})).toBe("first external");
    writeFileSync(
      join(root, "compiler.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@shared/*": ["./shared/*"] }, jsx: "react" } }),
    );
    expect((await prepareExtensionRevision(source)).loadKey).not.toBe(next.loadKey);
  });

for (const mode of ["static", "opaque"])
  test(`nested ${mode} imports retain their own package resolution beside a root dependency`, async () => {
    const source = fixture();
    const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
    manifest.dependencies = { foo: "1.0.0" };
    writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
    for (const [folder, value] of [
      ["node_modules/foo", "root"],
      ["src/node_modules/foo", "nested"],
    ]) {
      const dependency = join(source, folder!);
      mkdirSync(dependency, { recursive: true });
      writeFileSync(
        join(dependency, "package.json"),
        JSON.stringify({ name: "foo", version: "1.0.0", main: "index.js" }),
      );
      writeFileSync(join(dependency, "index.js"), `export const value = ${JSON.stringify(value)};`);
    }
    writeFileSync(
      join(source, "src", "helper.ts"),
      mode === "static"
        ? 'export { value as nested } from "foo";'
        : 'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const name = "foo"; export const nested = load(name).value;',
    );
    writeFileSync(
      join(source, "extension.ts"),
      'import { value } from "foo"; import { nested } from "./src/helper"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value + ":" + nested }] };',
    );
    const revision = await prepareExtensionRevision(source);
    const loaded = await loadExtensionPackage({ path: source }, [], { preparedRevision: revision });
    expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("root:nested");
  });

test("runtime load identity includes own modules reached through compiler aliases", async () => {
  const source = fixture();
  writeFileSync(join(source, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@local/*": ["./*"] } } }));
  writeFileSync(join(source, "helper.ts"), 'export const value = "first";');
  writeFileSync(
    join(source, "extension.ts"),
    'import { value } from "@local/helper"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value }] };',
  );
  const first = await prepareExtensionRevision(source);
  writeFileSync(join(source, "helper.ts"), 'export const value = "second";');
  const second = await prepareExtensionRevision(source);
  expect(second.loadKey).not.toBe(first.loadKey);
  const loaded = await loadExtensionPackage({ path: source }, [], { preparedRevision: second });
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("second");
});

test("shared source records retain one physical ancestor dependency binding", async () => {
  const source = fixture();
  const root = join(source, "..");
  const dependency = join(root, "store", "foo");
  mkdirSync(dependency, { recursive: true });
  mkdirSync(join(root, "node_modules"));
  mkdirSync(join(root, "shared"));
  writeFileSync(join(dependency, "package.json"), JSON.stringify({ name: "foo", version: "1.0.0", main: "index.js" }));
  writeFileSync(join(dependency, "index.js"), 'export const value = "shared";');
  symlinkSync(dependency, join(root, "node_modules", "foo"), "junction");
  writeFileSync(join(root, "shared", "helper.ts"), 'export { value as sibling } from "foo";');
  writeFileSync(
    join(source, "extension.ts"),
    'import { value } from "foo"; import { sibling } from "../shared/helper"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value + ":" + sibling }] };',
  );
  const revision = await prepareExtensionRevision(source);
  const loaded = await loadExtensionPackage({ path: source }, [], { preparedRevision: revision });
  expect(await loaded!.definition.commands![0].run({} as never, {})).toBe("shared:shared");
});
