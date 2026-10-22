import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contract, createRow, fixtureVersion, owners, scenarios, type Workload, workload } from "storage-scale-fixture";

export const writeFixture = async (root: string, kind: Workload) => {
  mkdirSync(root, { recursive: true });
  const spec = workload(kind);
  const ownerStats = [];
  for (const owner of owners(spec)) {
    const writer = Bun.file(join(root, `owner-${owner.index}.jsonl`)).writer();
    const hash = createHash("sha256");
    const sizes: number[] = [];
    for (let index = 0; index < owner.rows; index++) {
      const row = createRow(kind, owner.index, index, 3);
      const json = JSON.stringify(row);
      sizes.push(Buffer.byteLength(json));
      const line = `${json}\n`;
      hash.update(line);
      writer.write(line);
    }
    await writer.end();
    sizes.sort((a, b) => a - b);
    ownerStats.push({
      ...owner,
      sha256: hash.digest("hex"),
      bytes: sizes.reduce((sum, size) => sum + size, 0),
      minBytes: sizes[0],
      medianBytes: sizes[Math.floor(sizes.length / 2)],
      maxBytes: sizes.at(-1),
      fields: Object.keys(createRow(kind, owner.index, 0, 3)).length,
      tail16KiB: sizes.filter((size) => size >= 16_384).length,
    });
  }
  const manifest = {
    fixtureVersion,
    spec,
    contract,
    owners: ownerStats,
    history: { createsPerResource: 1, editsPerResource: 3, rounds: [0, 1, 2, 3], atomicRows: 100 },
    churn: {
      separate: true,
      perOwner: owners(spec).map((owner) => owner.rows),
      idPrefix: "churn",
      createsPerResource: 1,
      editsPerResource: 3,
      deleteEach: true,
    },
    source: "packages/storage-scale-fixture/src/fixture.ts",
    scenarios: scenarios(kind),
  };
  writeFileSync(join(root, "fixture.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
};
