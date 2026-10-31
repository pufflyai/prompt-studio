import { rmSync } from "node:fs";
import { join } from "node:path";

// The package ships its TypeScript source. Tests and their helpers stay in the repository.
const destination = join(import.meta.dir, "../.publish");
for (const pattern of ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/test-*.ts"])
  for (const path of new Bun.Glob(pattern).scanSync({ cwd: destination })) rmSync(join(destination, path));
