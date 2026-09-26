import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const referencedFiles = (code: string, pattern: RegExp) => [
  ...new Set([...code.matchAll(pattern)].map((match) => match[1]!)),
];

// Library builds inline assets, so bundling a consumer does not prove the packed ui package ships
// Monaco. This resolves the Monaco files through the installed package's exports instead.
export const verifyMonacoPackageAssets = (consumerDirectory: string) => {
  const script = Bun.resolveSync("@pstdio/ui/monaco/monaco.js", consumerDirectory);
  const stylesheet = Bun.resolveSync("@pstdio/ui/monaco/monaco.css", consumerDirectory);
  const workers = referencedFiles(readFileSync(script, "utf8"), /["'`](assets\/[\w.-]+\.worker-[\w-]+\.js)["'`]/g);
  const fonts = referencedFiles(readFileSync(stylesheet, "utf8"), /url\(\.\/(assets\/[\w.-]+\.ttf)\)/g);
  if (workers.length === 0) throw new Error("@pstdio/ui/monaco/monaco.js references no worker files.");

  for (const file of [...workers, ...fonts]) {
    if (!existsSync(join(dirname(script), file))) throw new Error(`@pstdio/ui is missing Monaco file ${file}.`);
  }
  return { workers: workers.length, fonts: fonts.length };
};
