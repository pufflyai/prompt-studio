import { heapStats } from "bun:jsc";
import assert from "node:assert/strict";
import { readRuntimeModuleImports } from "./runtime-source-snapshot";

const body = ".item { color: #123456; padding: 1rem; }\n".repeat(6400);
const revisions = 64;

function parseRevision(revision: number) {
  const file = `./themes/stylesheet-for-revision-${revision}`;
  const contents = Buffer.from(`@import "${file}.css"; @import "${file}\\d800.css";\n${body}`);
  assert.deepEqual(
    readRuntimeModuleImports("index.css", () => contents),
    [`${file}.css`, `${file}\ud800.css`],
  );
}

async function retainedBytes() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  Bun.gc(true);
  return heapStats().extraMemorySize;
}

parseRevision(-1);
const before = await retainedBytes();
for (let revision = 0; revision < revisions; revision++) parseRevision(revision);
const after = await retainedBytes();
console.log(JSON.stringify({ retained: after - before, sourceBytes: body.length * revisions }));
