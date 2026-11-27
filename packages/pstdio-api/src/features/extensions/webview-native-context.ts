import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { hashRevisionSource, inspectCompilerConfiguration } from "pstdio-extensions/revision-dependencies";

const locks = new Set([
  "package.json",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

/** Logical package numbers keep identities stable when source snapshots move. */
export const createNativeWebviewIdentity = () => {
  const owners = new Map<string, string>();
  const ids = new Map<string, string>();
  const physical = new Map<string, string>();
  const ownerOf = (file: string) => {
    const visited: string[] = [];
    let current = dirname(file);
    while (!owners.has(current) && !existsSync(join(current, "package.json")) && dirname(current) !== current) {
      visited.push(current);
      current = dirname(current);
    }
    if (!owners.has(current) && !existsSync(join(current, "package.json")))
      throw new Error("An input outside a package needs conservative inspection.");
    const owner = owners.get(current) ?? current;
    owners.set(current, owner);
    for (const path of visited) owners.set(path, owner);
    return owner;
  };
  const keys = new Map<string, string>();
  const keyCanonical = (canonical: string) => {
    const cached = keys.get(canonical);
    if (cached !== undefined) return cached;
    const owner = ownerOf(canonical);
    let id = ids.get(owner);
    if (id === undefined) {
      id = String(ids.size);
      ids.set(owner, id);
    }
    const result = `package-${id}/${relative(owner, canonical).replaceAll("\\", "/")}`;
    keys.set(canonical, result);
    return result;
  };
  const key = (file: string) => {
    let canonical = physical.get(file);
    if (!canonical) {
      canonical = realpathSync(file);
      physical.set(file, canonical);
    }
    return keyCanonical(canonical);
  };
  return { key, keyCanonical, ownerOf, ids };
};

/** Preserve compiler context and opaque asset identity without resolving dependencies again. */
export const nativeWebviewContext = (files: string[], identity: ReturnType<typeof createNativeWebviewIdentity>) => {
  const hash = createHash("sha256");
  const configurations: Parameters<typeof inspectCompilerConfiguration>[4] = new Map();
  const directories = new Map<string, Set<string>>();
  const assets = new Set<string>();
  const packages = new Set<string>();
  const externalConfigs = new Map<string, string>();
  const configurationKey = (path: string) => {
    try {
      return identity.keyCanonical(path);
    } catch {
      let key = externalConfigs.get(path);
      if (!key) {
        key = `compiler-${externalConfigs.size}`;
        externalConfigs.set(path, key);
      }
      return key;
    }
  };
  for (const file of [...new Set(files)].sort((a, b) =>
    identity.keyCanonical(a).localeCompare(identity.keyCanonical(b)),
  )) {
    if (!existsSync(file)) continue;
    const contents = readFileSync(file);
    hash.update(identity.keyCanonical(file)).update("\0").update(contents).update("\0");
    const owner = identity.ownerOf(file);
    packages.add(owner);
    const visited = directories.get(owner) ?? new Set<string>();
    directories.set(owner, visited);
    inspectCompilerConfiguration(
      owner,
      file,
      new Set(),
      visited,
      configurations,
      () => {},
      readFileSync,
      () => {},
    );
    if (
      /\.[cm]?[jt]sx?$/.test(file) &&
      /import\.meta|\b__dirname\b|\b__filename\b|\breadFile/.test(contents.toString())
    )
      assets.add(owner);
  }
  for (const owner of [...packages].sort((a, b) => Number(identity.ids.get(a)) - Number(identity.ids.get(b)))) {
    if (identity.ids.get(owner) === "0") continue;
    const manifest = join(owner, "package.json");
    if (existsSync(manifest))
      hash.update(identity.keyCanonical(manifest)).update("\0").update(readFileSync(manifest)).update("\0");
  }
  for (const [path, input] of [...configurations].sort(([a], [b]) => a.localeCompare(b)))
    hash.update(configurationKey(path)).update("\0").update(input.contents).update("\0");
  for (const owner of [...assets].sort((a, b) => Number(identity.ids.get(a)) - Number(identity.ids.get(b))))
    hash
      .update(`package-${identity.ids.get(owner)}`)
      .update("\0")
      .update(hashRevisionSource(owner, (path) => !locks.has(path)));
  return hash.digest("hex");
};
