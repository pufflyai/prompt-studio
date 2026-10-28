import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const mergeBuildCaches = (artifacts: string, destination: string) => {
  mkdirSync(destination, { recursive: true });
  const copied = new Set<string>();
  for (const producer of readdirSync(artifacts).sort()) {
    for (const archive of readdirSync(join(artifacts, producer)).sort()) {
      if (!archive.endsWith(".tar.gz") || copied.has(archive)) continue;
      // One task hash can have different tar metadata on different runners. Keep
      // one complete producer: concurrent artifact extraction can mix their bytes.
      copyFileSync(join(artifacts, producer, archive), join(destination, archive));
      copied.add(archive);
    }
  }
};

if (import.meta.main) mergeBuildCaches(process.argv[2]!, process.argv[3]!);
