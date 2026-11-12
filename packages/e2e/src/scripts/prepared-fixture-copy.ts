import { cpSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

// Tarballs remain immutable inputs owned by the enclosing executor. Every writable
// source belongs to this invocation, including symlink targets. Runtime installation
// owns dependencies; copying prepared node_modules repeats gigabytes of disposable work.
export const copyPreparedFixtures = (prepared: string, home: string, names: string[]) => {
  const catalog = JSON.parse(readFileSync(join(prepared, "sources.json"), "utf8")) as {
    sources: Record<string, string>;
    packageCache: string;
  };
  if (!catalog.packageCache || !statSync(catalog.packageCache, { throwIfNoEntry: false })?.isDirectory())
    throw new Error("Completed fixture package cache missing");
  const started = performance.now();
  let bytesCopied = 0;
  const sources: Record<string, string> = {};
  for (const name of names) {
    if (!catalog.sources[name]) throw new Error(`Prepared fixture missing: ${name}`);
    const destination = join(home, "fixtures", name, "extension-source");
    mkdirSync(join(home, "fixtures", name), { recursive: true });
    cpSync(catalog.sources[name]!, destination, {
      recursive: true,
      dereference: true,
      filter: (path) => {
        if (basename(path) === "node_modules") return false;
        const stat = statSync(path);
        if (stat.isFile()) bytesCopied += stat.size;
        return true;
      },
    });
    sources[name] = destination;
  }
  return {
    sources,
    packageCache: catalog.packageCache,
    bytesCopied,
    copyMs: performance.now() - started,
    reuseHits: names.length,
  };
};
