import { appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Temporary workaround, see .pstdio/docs/adrs/0030-temporary-dts-export-marker.md.
// `export {};` stops TypeScript from treating every top-level declaration in a .d.ts file as exported.
export const markDtsModules = (dist: string) => {
  for (const file of readdirSync(dist).filter((name) => name.endsWith(".d.ts"))) {
    appendFileSync(join(dist, file), "\nexport {};\n");
  }
};

if (import.meta.main) markDtsModules(process.argv[2] ?? "dist");
