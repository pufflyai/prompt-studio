import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyProviderPackageConsumer } from "./provider-package-consumer";

const run = (cwd: string, args: string[]) => {
  const result = Bun.spawnSync(["bun", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.toString();
};

const readManifest = (path: string) => JSON.parse(readFileSync(join(path, "package.json"), "utf8"));

const nativeEntries: Record<string, readonly string[]> = {
  "@pstdio/sdk": ["./resources", "./api", "./client", "./extensions", "./prompts", "./hooks"],
  "@pstdio/workbench": [".", "./storage", "./webview-runtime"],
};

const consumerDependencies = (packages: { path: string; archive: string }[], react: boolean) => {
  const dependencies: Record<string, string> = { typescript: "6.0.2" };
  const overrides: Record<string, string> = {};
  const imports: string[] = [];
  for (const pkg of packages) {
    const manifest = readManifest(pkg.path);
    dependencies[manifest.name] = `file:${pkg.archive}`;
    overrides[manifest.name] = `file:${pkg.archive}`;
    if (react) {
      const development = readManifest(resolve(pkg.path, ".."));
      for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
        dependencies[name] = development.devDependencies?.[name] ?? range;
      }
    }
    for (const entry of Object.keys(manifest.exports)) {
      if (entry.endsWith(".css") || (!react && !nativeEntries[manifest.name]?.includes(entry))) continue;
      imports.push(`${manifest.name}${entry === "." ? "" : entry.slice(1)}`);
    }
  }
  if (react)
    Object.assign(dependencies, {
      vite: "^7.2.4",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@types/node": "^25.0.0",
    });
  return { dependencies, overrides, imports };
};

const checkConsumer = (root: string, packages: { path: string; archive: string }[], react: boolean) => {
  const directory = join(root, react ? "react-consumer" : "native-consumer");
  mkdirSync(directory);
  const { dependencies, overrides, imports } = consumerDependencies(packages, react);
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: react ? "react-consumer" : "native-consumer",
      private: true,
      type: "module",
      dependencies,
      overrides,
    }),
  );
  run(directory, react ? ["install"] : ["install", "--omit", "peer"]);
  writeFileSync(
    join(directory, "consumer.ts"),
    imports
      .map((entry, index) => `import * as entry${index} from ${JSON.stringify(entry)}; export { entry${index} };`)
      .join("\n") +
      (react && imports.includes("@pstdio/workbench/react")
        ? `
import type { ReactAttributeDescriptor, ReactBoardColumnConfig } from "@pstdio/workbench/react";
const invalidAttribute: ReactAttributeDescriptor = {
  id: "title", label: "Title", type: { kind: "string" },
  // @ts-expect-error React cell callbacks must return React nodes.
  render: () => ({ invalid: true }),
};
const invalidColumn: ReactBoardColumnConfig = {
  // @ts-expect-error React column icons must be components.
  actions: [{ id: "create", label: "Create", icon: "plus" }],
};
void [invalidAttribute, invalidColumn];
`
        : ""),
  );
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        lib: ["ES2022", "ESNext.Disposable", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        types: react ? ["node"] : [],
      },
      include: ["consumer.ts"],
    }),
  );
  run(directory, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
  if (react) {
    writeFileSync(
      join(directory, "vite.config.ts"),
      `import { defineConfig } from "vite";
export default defineConfig({ build: { lib: { entry: "consumer.ts", formats: ["es"] } } });`,
    );
    run(directory, ["node_modules/vite/bin/vite.js", "build"]);
  } else {
    for (const condition of [[], ["--conditions=source"]]) {
      run(directory, [...condition, "consumer.ts"]);
    }
  }
  console.log(
    `Typechecked ${imports.length} entries and ${react ? "bundled them for the browser with declared peers" : "loaded them in Bun with default and source conditions without React type peers"}.`,
  );
};

export const verifyPublicPackages = (repoRoot: string, sdkOnly = false) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-public-packages-"));
  try {
    const packages = (sdkOnly ? ["sdk"] : ["sdk", "ui", "pstdio-workbench"]).map((name) => {
      const path = resolve(repoRoot, "packages", name, ".publish");
      const archive = join(root, `${name}.tgz`);
      run(path, ["pm", "pack", "--filename", archive]);
      return { path, archive };
    });
    checkConsumer(root, packages, false);
    checkConsumer(root, packages, true);
    verifyProviderPackageConsumer(root, packages[0]!.archive);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

if (import.meta.main) verifyPublicPackages(resolve(import.meta.dirname, "../.."), process.argv.includes("--sdk-only"));
