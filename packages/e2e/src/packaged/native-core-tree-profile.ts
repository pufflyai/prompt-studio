import { readdirSync } from "node:fs";
import { join } from "node:path";

export const profileOwnedCoreTree = async (root: string) => {
  const started = performance.now();
  const trees = [];
  for (const top of readdirSync(root, { withFileTypes: true })) {
    const counts = { name: top.name, files: 0, directories: 0, links: 0 };
    const pending = [join(root, top.name)];
    if (top.isSymbolicLink()) {
      counts.links++;
      pending.pop();
    } else if (top.isFile()) {
      counts.files++;
      pending.pop();
    }
    while (pending.length) {
      const path = pending.pop()!;
      counts.directories++;
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) counts.links++;
        else if (entry.isDirectory()) pending.push(join(path, entry.name));
        else counts.files++;
      }
    }
    console.log(`Owned core tree: ${JSON.stringify(counts)}`);
    trees.push(counts);
  }
  const result = { root, inventoryMs: performance.now() - started, trees };
  console.log(`Owned core inventory: ${JSON.stringify(result)}`);
  await Bun.write(
    join(
      import.meta.dirname,
      "../../../../.pstdio/extension-storage/pstdio.pstdio-artifacts/native-core-profile/inventory.json",
    ),
    JSON.stringify(result, null, 2),
  );
};
