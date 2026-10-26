import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

export const fixtureVersion = "responsive-extensions-recreated-v1";
export const checksumIterations = 1_000_000_000;
export const initializationIterations = 250_000_000;
export const viewCount = 6;
export const sharedModuleCount = 64;
export const exportsPerModule = 1024;

export const checksumEntry = (initialization = 0, loopMarker = "") => `
import { writeFileSync } from 'node:fs';
const initializedAt = Date.now();
let initializedChecksum = 0;
for (let i = 0; i < ${initialization}; i++) initializedChecksum = (initializedChecksum + i) | 0;
const initializedEnd = Date.now();
export default { commands: [
  { id: 'compute', ref: { kind: 'command', id: 'compute' }, title: 'Compute', mutating: true,
    run: async (ctx) => {
      await ctx.storage.set('started', true);
      const startedAt = Date.now(); let checksum = 0;
      for (let i = 0; i < ${checksumIterations}; i++) checksum = (checksum + i) | 0;
      const endedAt = Date.now();
      const value = { checksum, iterations: ${checksumIterations}, startedAt, endedAt, pid: process.pid };
      await ctx.storage.set('result', value); return value;
    } },
  { id: 'read', ref: { kind: 'command', id: 'read' }, title: 'Read',
    run: async (ctx) => ctx.storage.get('result') },
  { id: 'initialization', ref: { kind: 'command', id: 'initialization' }, title: 'Initialization',
    run: () => ({ checksum: initializedChecksum, iterations: ${initialization}, startedAt: initializedAt, endedAt: initializedEnd, pid: process.pid }) },
  { id: 'loop', ref: { kind: 'command', id: 'loop' }, title: 'Loop',
    run: () => { writeFileSync(${JSON.stringify(loopMarker)}, String(process.pid)); while (true) {} } }
] };`;

export const writeSharedRevision = (sourcePath: string, revision: number, invalid = false) => {
  const imports = Array.from({ length: sharedModuleCount }, (_, i) => `import * as m${i} from './modules/m${i}';`);
  writeFileSync(
    join(sourcePath, "shared.ts"),
    invalid
      ? "export const = invalid;"
      : `${imports.join("\n")}
export const revision = 'revision-${String(revision).padStart(6, "0")}';
export const values = [${imports.map((_, i) => `m${i}`).join(",")}];\n`,
  );
};

export const createResponsivenessFixtures = (root: string, builds: boolean) => {
  const sourcePath = createTestExtensionSource({ root, name: "work", installName: "work", displayName: "Work" });
  const probePath = createTestExtensionSource({ root, name: "probe", installName: "probe", displayName: "Probe" });
  writeFileSync(
    join(probePath, "extension.ts"),
    `export default { commands: [{
    id: 'ping', ref: { kind: 'command', id: 'ping' }, title: 'Ping',
    run: async (ctx) => ({ value: await ctx.storage.get('ping'), projectId: ctx.projectId })
  }] };`,
  );
  if (!builds) {
    writeFileSync(join(sourcePath, "extension.ts"), checksumEntry(0, join(root, "loop-started")));
    return { sourcePath, probePath };
  }
  mkdirSync(join(sourcePath, "modules"));
  for (let i = 0; i < sharedModuleCount; i++) {
    writeFileSync(
      join(sourcePath, "modules", `m${i}.ts`),
      Array.from(
        { length: exportsPerModule },
        (_, j) =>
          `export const value${j} = (seed: number) => Math.imul(seed ^ ${i * exportsPerModule + j}, 2654435761) >>> 0;`,
      ).join("\n"),
    );
  }
  writeSharedRevision(sourcePath, 0);
  for (let i = 0; i < viewCount; i++) {
    writeFileSync(
      join(sourcePath, `view${i}.ts`),
      `import { revision, values } from './shared'; globalThis.fixture${i} = { revision, values };`,
    );
  }
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default { views: [${Array.from(
      { length: viewCount },
      (_, i) => `{
    id: 'view${i}', title: 'View ${i}', body: { kind: 'webview', entry: { kind: 'package-asset', path: './view${i}.ts', baseUrl: import.meta.url } }
  }`,
    ).join(",")} ] };`,
  );
  return { sourcePath, probePath };
};

export const enableBody = (root: string, name: string) => ({
  displayName: name,
  extensionId: `test.${name}`,
  manifest: { id: `test.${name}`, name },
  name,
  sourceHash: null,
  sourceKind: "local_path",
  sourcePath: join(root, "extensions", name),
  sourceRef: null,
  version: "0.0.0",
});

export const expectedChecksum = (iterations: number) =>
  Number(BigInt.asIntN(32, (BigInt(iterations) * BigInt(iterations - 1)) / 2n));
