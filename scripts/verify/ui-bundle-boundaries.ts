import { resolve } from "node:path";

// Run against a fresh package consumer so this also checks the published chunks and styles.
const result = await Bun.build({
  entrypoints: [resolve("node_modules/@pstdio/ui/dist/index.js")],
  target: "browser",
  packages: "external",
  metafile: true,
});
if (!result.success) throw new AggregateError(result.logs, "Could not bundle the published UI root entry");
const sources = (
  await Promise.all(
    Object.keys(result.metafile!.inputs).map(async (input) => {
      const map = Bun.file(resolve(`${input}.map`));
      return (await map.exists()) ? ((await map.json()).sources as string[]) : [];
    }),
  )
).flat();
if (!sources.length) throw new Error("Published UI source maps are missing");
const optional = sources.filter((path) => /\/(canvas|dependency-timeline)(\/|\.ts)/.test(path));
if (optional.length) throw new Error(`The UI root entry includes optional modules: ${optional.join(", ")}`);
console.log("Verified the published UI root excludes optional Canvas and dependency timeline code and styles.");
