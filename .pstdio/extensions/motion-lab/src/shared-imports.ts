import { exportsFor } from "./shared-exports";

export const linkSharedImports = async (code: string) => {
  const specifiers = new Set(new Bun.Transpiler({ loader: "js" }).scanImports(code).map((item) => item.path));
  // ADR 0051: finish export discovery before starting a build; nested Bun builds stall.
  const sharedExports = new Map(
    await Promise.all([...specifiers].map(async (name) => [name, await exportsFor(name)] as const)),
  );
  return Bun.build({
    entrypoints: ["motion-scene"],
    throw: false,
    target: "browser",
    format: "esm",
    plugins: [
      {
        name: "motion-shared-imports",
        setup(build) {
          build.onResolve({ filter: /^motion-scene$/ }, () => ({ path: "motion-scene", namespace: "scene" }));
          build.onLoad({ filter: /.*/, namespace: "scene" }, () => ({ contents: code, loader: "js" }));
          build.onResolve({ filter: /.*/ }, (args) => {
            if (sharedExports.has(args.path)) return { path: args.path, namespace: "shared" };
          });
          build.onLoad({ filter: /.*/, namespace: "shared" }, (args) => {
            const names = sharedExports
              .get(args.path)!
              .filter((name) => name !== "default" && /^[A-Za-z_$][\w$]*$/.test(name));
            return {
              contents: `const m=globalThis.__motionLabShared[${JSON.stringify(args.path)}]; export default m.default ?? m; ${names.map((name) => `export const ${name}=m[${JSON.stringify(name)}];`).join("\n")}`,
              loader: "js",
            };
          });
        },
      },
    ],
  });
};
