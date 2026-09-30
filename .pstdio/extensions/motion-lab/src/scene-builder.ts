import { posix } from "node:path";
import { exportsFor } from "./shared-exports";

export const sharedSpecifiers = [
  "react",
  "react/jsx-runtime",
  "remotion",
  "@chakra-ui/react",
  "@pstdio/ui",
  "@pstdio/ui/chat-ui",
  "lucide-react",
  "motion-lab/kit",
];
export interface BuildError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export const buildScene = async (files: Record<string, string>) => {
  try {
    const sharedExports = new Map(
      await Promise.all(sharedSpecifiers.map(async (name) => [name, await exportsFor(name)] as const)),
    );
    const result = await Bun.build({
      entrypoints: ["./scene.tsx"],
      throw: false,
      jsx: { development: false },
      target: "browser",
      format: "esm",
      plugins: [
        {
          name: "motion-study",
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (sharedSpecifiers.includes(args.path)) return { path: args.path, namespace: "shared" };
              if (!args.path.startsWith(".")) throw new Error(`"${args.path}" is not available to Motion Lab scenes`);
              const path = posix.normalize(posix.join(posix.dirname(args.importer || "scene.tsx"), args.path));
              if (path.startsWith("../")) throw new Error("Scene imports must stay inside the study folder");
              const resolved = [path, `${path}.tsx`, `${path}.ts`, `${path}/index.tsx`, `${path}/index.ts`].find(
                (name) => Object.hasOwn(files, name),
              );
              if (!resolved) throw new Error(`Study file not found: ${path}`);
              return { path: resolved, namespace: "study" };
            });
            build.onLoad({ filter: /.*/, namespace: "study" }, (args) => ({
              contents: files[args.path],
              loader: args.path.endsWith(".json") ? "json" : "tsx",
            }));
            build.onLoad({ filter: /.*/, namespace: "shared" }, async (args) => {
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
    if (!result.success) {
      const log = result.logs.find((item) => item.level === "error")!;
      return {
        error: {
          message: log.message,
          file: log.position?.file,
          line: log.position?.line,
          column: log.position?.column,
        } satisfies BuildError,
      };
    }
    return { code: await result.outputs[0].text() };
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : String(error) } satisfies BuildError };
  }
};
