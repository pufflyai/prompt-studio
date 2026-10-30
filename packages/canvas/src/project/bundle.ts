import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CanvasEntry } from "./manifest";

const RUNTIME = resolve(import.meta.dir, "../runtime/frame-runtime.tsx");

// The runtime lives in this package, but every frame must share the project's single React.
const projectReact = (root: string): Bun.BunPlugin => ({
  name: "pstdio-canvas-project-react",
  setup(build) {
    build.onResolve({ filter: /^react(-dom)?($|\/)/ }, (args) => ({ path: Bun.resolveSync(args.path, root) }));
  },
});

const ownFiles = (root: string, canvas: CanvasEntry) =>
  new Set([join(root, canvas.id), ...(canvas.preview ? [join(root, canvas.preview)] : [])]);

const entrySource = (root: string, canvases: CanvasEntry[]) => {
  const lines = canvases.map((canvas) => {
    const load = `load: () => import(${JSON.stringify(join(root, canvas.id))})`;
    const preview = canvas.preview ? `, preview: () => import(${JSON.stringify(join(root, canvas.preview))})` : "";
    return `  ${JSON.stringify(canvas.id)}: { ${load}${preview} },`;
  });
  return `import { mountFrameRuntime } from ${JSON.stringify(RUNTIME)};\nmountFrameRuntime({\n${lines.join("\n")}\n});\n`;
};

// Canvas and preview files are entry points too, so each gets its own CSS bundle and a frame
// loads only the styles of the canvas it shows.
const runBuild = async (root: string, entry: string, canvases: CanvasEntry[], outdir?: string) =>
  Bun.build({
    entrypoints: [entry, ...new Set(canvases.flatMap((canvas) => [...ownFiles(root, canvas)]))],
    ...(outdir ? { outdir } : {}),
    target: "browser",
    format: "esm",
    splitting: true,
    metafile: true,
    throw: false,
    // Frames load modules from blob URLs, so relative preload links cannot resolve.
    modulePreload: false,
    define: { "process.env.NODE_ENV": '"production"' },
    naming: { entry: "[name]-[hash].[ext]", chunk: "chunk-[hash].[ext]", asset: "[name]-[hash].[ext]" },
    plugins: [projectReact(root)],
  });

type BuildLogs = Bun.BuildOutput["logs"];

const errorFile = (root: string, log: BuildLogs[number]) =>
  log.level === "error" && log.position?.file ? resolve(root, log.position.file) : undefined;

const describe = (root: string, logs: BuildLogs, files?: Set<string>) =>
  logs
    .filter((log) => log.level === "error" && (!files || files.has(errorFile(root, log) ?? "")))
    .map((log) => String(log))
    .join("\n") || "The canvas could not be built.";

const failedFiles = (root: string, logs: BuildLogs) => new Set(logs.flatMap((log) => errorFile(root, log) ?? []));

type WriteEntry = (name: string, canvases: CanvasEntry[]) => Promise<string>;

// The broken import is shared code, so build each canvas alone to find the ones that use it.
const isolateFailures = async (root: string, write: WriteEntry, canvases: CanvasEntry[]) => {
  const failures = new Map<CanvasEntry, BuildLogs>();
  for (const canvas of canvases) {
    const alone = await runBuild(root, await write("isolated", [canvas]), [canvas]);
    if (!alone.success) failures.set(canvas, alone.logs);
  }
  return failures;
};

/**
 * Builds every canvas into `outdir`. A canvas that cannot be built is left out with its error, so
 * one broken import never hides the other canvases.
 */
export const bundleCanvases = async (root: string, workdir: string, outdir: string, canvases: CanvasEntry[]) => {
  const entries = join(workdir, "entries");
  await mkdir(entries, { recursive: true });
  const write: WriteEntry = async (name, included) => {
    const path = join(entries, `${name}.tsx`);
    await writeFile(path, entrySource(root, included));
    return path;
  };
  const errors = new Map<string, string>();
  // Files that broke a build are inputs too: fixing one must trigger a rebuild.
  const failed = new Set<string>();
  let included = canvases;
  for (;;) {
    const result = await runBuild(root, await write("frame", included), included, outdir);
    if (result.success) return { result, errors, failedFiles: failed };
    const files = failedFiles(root, result.logs);
    let failures = new Map(
      included
        .filter((canvas) => [...ownFiles(root, canvas)].some((file) => files.has(file)))
        .map((canvas) => [canvas, result.logs] as const),
    );
    if (!failures.size) failures = await isolateFailures(root, write, included);
    if (!failures.size) throw new Error(describe(root, result.logs));
    for (const [canvas, logs] of failures) {
      for (const file of failedFiles(root, logs)) failed.add(file);
      // A canvas's own broken import names its own file; a shared one is the only error in its build.
      const own = logs === result.logs ? ownFiles(root, canvas) : undefined;
      errors.set(canvas.id, describe(root, logs, own));
    }
    included = included.filter((canvas) => !failures.has(canvas));
  }
};
