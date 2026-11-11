import { cpSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Tarballs remain immutable inputs owned by the enclosing executor. Every writable
// source and dependency tree belongs to this invocation, including symlink targets.
export const copyPreparedFixtures = (prepared: string, home: string, names: string[]) => {
  const catalog = JSON.parse(readFileSync(join(prepared, "sources.json"), "utf8")) as Record<string, string>;
  const started = performance.now();
  let bytesCopied = 0;
  const sources: Record<string, string> = {};
  for (const name of names) {
    if (!catalog[name]) throw new Error(`Prepared fixture missing: ${name}`);
    const destination = join(home, "fixtures", name, "extension-source");
    mkdirSync(join(home, "fixtures", name), { recursive: true });
    cpSync(catalog[name]!, destination, {
      recursive: true,
      dereference: true,
      filter: (path) => {
        const stat = statSync(path);
        if (stat.isFile()) bytesCopied += stat.size;
        return true;
      },
    });
    sources[name] = destination;
  }
  return { sources, bytesCopied, copyMs: performance.now() - started, reuseHits: names.length };
};
