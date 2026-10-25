import { statSync } from "node:fs";
import { resolve } from "node:path";

export const conformanceFiles = (paths: string[], priorities: string[]) => {
  const files = paths.flatMap((path) => {
    const absolute = resolve(path);
    if (statSync(absolute).isFile()) return [absolute];
    return Array.from(new Bun.Glob("**/*.integration.ts").scanSync({ cwd: absolute, absolute: true }));
  });
  const selected = [...new Set(files)]
    .filter((file) => {
      const priority = file.match(/\.p([0-3])\.integration\.ts$/)?.[1];
      return priority && priorities.includes(`P${priority}`);
    })
    .sort();
  if (!selected.length) throw new Error("No conformance contracts selected");
  return selected;
};
