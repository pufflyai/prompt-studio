import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { isPackagedRuntime } from "pstdio-paths";
import { trackPreparationStage } from "./preparation-stages";
import { extensionWebviewBuildOptions } from "./webview-build-options";
import { createNativeWebviewIdentity, nativeWebviewContext } from "./webview-native-context";

const execute = promisify(execFile);
const createBuild = (packagePath: string, entryPaths: string[], batch: boolean) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-webview-input-build-")));
  const stage = trackPreparationStage([root]);
  mkdirSync(join(root, "entries"));
  // One unsplit inspection entry avoids duplicate output and Bun's path-based split-entry IDs.
  const wrapper = join(root, "entries", "inspection.ts");
  writeFileSync(
    wrapper,
    entryPaths.map((entry, index) => `export * as view${index} from ${JSON.stringify(entry)};`).join("\n"),
  );
  const wrappers = [wrapper];
  const builds = [batch ? wrappers : entryPaths].map((entries, index) => {
    const outdir = join(root, `dist-${index}`);
    const metafile = join(root, `build-${index}.json`);
    const options = extensionWebviewBuildOptions;
    const args = [
      "build",
      ...entries,
      `--outdir=${outdir}`,
      `--metafile=${metafile}`,
      `--target=${options.target}`,
      `--format=${options.format}`,
      ...(options.minify ? ["--minify"] : []),

      "--no-macros",
      ...Object.entries(options.define).flatMap(([key, value]) => ["--define", `${key}=${value}`]),
      "--entry-naming=[dir]/[name].[ext]",
      `--chunk-naming=${options.naming.chunk}`,
      `--asset-naming=${options.naming.asset}`,
    ];
    return { args, outdir, metafile };
  });
  const options = {
    cwd: packagePath,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: "1", ...(isPackagedRuntime() ? { BUN_BE_BUN: "1" } : {}) },
    maxBuffer: 16 * 1024 * 1024,
  };
  const digest = () => {
    const hash = createHash("sha256").update(`native-browser-inputs-v6:${Bun.version}:${batch}\0`);
    const files: string[] = [];
    const identity = createNativeWebviewIdentity();
    for (const entry of entryPaths) identity.key(entry);
    const physical = new Map<string, string>();
    const canonical = (path: string) => {
      const cached = physical.get(path);
      if (cached) return cached;
      const resolved = resolve(packagePath, path);
      const result = existsSync(resolved) ? realpathSync(resolved) : path;
      physical.set(path, result);
      return result;
    };
    const keys = new Map<string, string>();
    const key = (path: string) => {
      const cached = keys.get(path);
      if (cached !== undefined) return cached;
      const resolved = canonical(path);
      if (!existsSync(resolved)) return path;
      const result = resolved.startsWith(root + sep)
        ? `<wrapper>/${basename(resolved)}`
        : identity.keyCanonical(resolved);
      keys.set(path, result);
      return result;
    };
    for (const [context, build] of builds.entries()) {
      type Input = {
        imports?: Array<{ path: string; kind: string; original?: string; external?: boolean; entryPoint?: string }>;
      };
      const inputs = JSON.parse(readFileSync(build.metafile, "utf8")).inputs as Record<string, Input>;
      const indexed = new Map(Object.entries(inputs).map(([path, input]) => [canonical(path), { path, input }]));
      const seen = new Set<string>();
      const bind = (imported: NonNullable<Input["imports"]>[number]) => ({
        kind: imported.kind,
        path: key(imported.entryPoint ?? imported.path),
        external: imported.entryPoint ? false : Boolean(imported.external),
        original: imported.original && isAbsolute(imported.original) ? key(imported.original) : imported.original,
      });
      const linked = (imported: NonNullable<Input["imports"]>[number]) => imported.entryPoint || !imported.external;
      const target = (imported: NonNullable<Input["imports"]>[number]) => imported.entryPoint ?? imported.path;
      const visit = (path: string) => {
        const resolved = canonical(path);
        if (seen.has(resolved)) return;
        const node = indexed.get(resolved);
        if (!node) return;
        seen.add(resolved);
        hash.update(key(node.path)).update("\0");
        const imports = node.input.imports ?? [];
        hash.update(JSON.stringify(imports.map(bind))).update("\0");
        if (existsSync(resolved) && !resolved.startsWith(root + sep)) files.push(resolved);
        imports.filter(linked).map(target).forEach(visit);
      };
      hash.update(String(context)).update("\0");
      for (const entry of batch ? wrappers : entryPaths) visit(entry);
      for (const path of Object.keys(inputs).sort()) {
        visit(path);
      }
    }
    // Bun omits some edges for extracted CSS and generated runtime modules.
    // Emitted bytes retain their ordering/resolution semantics as well as input identity.
    for (const build of builds) {
      const emitted = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
          a.name.localeCompare(b.name),
        )) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) emitted(path);
          else
            hash
              .update(relative(build.outdir, path).replaceAll("\\", "/"))
              .update("\0")
              .update(readFileSync(path))
              .update("\0");
        }
      };
      emitted(build.outdir);
    }
    hash.update(nativeWebviewContext(files, identity));
    return hash.digest("hex");
  };
  return {
    builds,
    options,
    digest,
    close: () => {
      rmSync(root, { recursive: true, force: true });
      stage.release();
    },
  };
};

/** Fresh native compilers inspect browser graphs; macros fall back without being executed. */
export const hashNativeWebviewInputs = (packagePath: string, entryPaths: string[]) => {
  const build = createBuild(packagePath, entryPaths, false);
  try {
    for (const { args } of build.builds) execFileSync(process.execPath, args, { ...build.options, stdio: "pipe" });
    return build.digest();
  } finally {
    build.close();
  }
};
export const hashNativeWebviewInputsAsync = async (packagePath: string, entryPaths: string[], batch = false) => {
  const build = createBuild(packagePath, entryPaths, batch);
  try {
    for (const { args } of build.builds) await execute(process.execPath, args, build.options);
    return build.digest();
  } finally {
    build.close();
  }
};
