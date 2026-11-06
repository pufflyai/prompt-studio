import path from "node:path";

const prefix = "packages/pstdio-sync/src/";
const dependencies: Record<string, readonly string[]> = {
  shared: [],
  text: ["shared"],
  presence: ["shared"],
  encryption: ["shared"],
  records: ["shared", "text"],
  relay: ["shared", "records", "text", "encryption"],
};
const external = new Set(["pstdio-sync-contracts", "yjs", "fast-diff"]);

/** Keep reusable data engines below host, transport and editor adapters. */
export const syncModuleViolation = (file: string, specifier: string) => {
  if (!file.startsWith(prefix) || /\.(?:p\d\.test|fixture|diagnostic)\.ts$/.test(file)) return;
  const local = file.slice(prefix.length);
  const module = local === "index.ts" ? "shared" : local.split("/")[0];
  if (!Object.hasOwn(dependencies, module)) return `${file}: place sync implementation in an owned module`;
  if (!specifier.startsWith(".")) {
    if (module === "relay" && specifier.startsWith("node:")) return;
    if (!external.has(specifier)) return `${file}: ${module} must not import ${specifier}`;
    return;
  }
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(local), specifier));
  const dependency = target.split("/")[0];
  if (dependency === module) return;
  if (!dependencies[module].includes(dependency)) return `${file}: ${module} must not depend on ${dependency}`;
  if (target !== dependency && target !== `${dependency}/index`) {
    return `${file}: import ${dependency} through its module entry point`;
  }
};
