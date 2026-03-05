import { cp, stat } from "node:fs/promises";
import { join } from "node:path";
import { git } from "./git";

type CopyIgnoredResult = {
  copied: string[];
};

export const copyIgnored = async (opts: {
  source: string;
  target: string;
  patterns?: string[];
}): Promise<CopyIgnoredResult> => {
  // get list of ignored files/directories in source
  let ignored: string[];
  try {
    const output = await git(opts.source, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"]);
    ignored = output.split("\n").filter((l) => l.length > 0);
  } catch {
    return { copied: [] };
  }

  if (ignored.length === 0) {
    return { copied: [] };
  }

  // filter by patterns if provided
  if (opts.patterns) {
    ignored = ignored.filter((entry) =>
      opts.patterns!.some((p) => entry === p || entry === `${p}/` || entry.startsWith(`${p}/`)),
    );
  }

  // deduplicate: if a directory is listed, skip its children
  const dirs = ignored.filter((e) => e.endsWith("/")).map((e) => e.slice(0, -1));
  const toProcess = ignored.filter((entry) => {
    const clean = entry.endsWith("/") ? entry.slice(0, -1) : entry;
    return !dirs.some((d) => clean !== d && clean.startsWith(`${d}/`));
  });

  const copied: string[] = [];
  for (const entry of toProcess) {
    const clean = entry.endsWith("/") ? entry.slice(0, -1) : entry;
    const srcPath = join(opts.source, clean);
    const dstPath = join(opts.target, clean);

    try {
      const info = await stat(srcPath);
      if (info.isDirectory()) {
        await cp(srcPath, dstPath, { recursive: true });
      } else {
        await cp(srcPath, dstPath);
      }
      copied.push(clean);
    } catch {
      // skip files that can't be copied
    }
  }

  return { copied };
};
