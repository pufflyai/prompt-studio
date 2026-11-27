import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hashExtensionDependencyInputs } from "pstdio-extensions/authoring";

/** The release and its host API range can change while Bun's locked dependency tree stays identical. */
export const installedDependencyHash = (root: string) => {
  const locks = ["bun.lock", "bun.lockb"].filter((name) => existsSync(join(root, name)));
  if (!locks.length || !existsSync(join(root, "package.json"))) return hashExtensionDependencyInputs(root);
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  delete manifest.version;
  if (manifest.pstdio && typeof manifest.pstdio === "object") {
    delete manifest.pstdio.runtimeCli;
    if (Object.keys(manifest.pstdio).length === 0) delete manifest.pstdio;
  }
  if (manifest.engines && typeof manifest.engines === "object") delete manifest.engines.pstdio;
  const hash = createHash("sha256").update(JSON.stringify(manifest));
  for (const name of locks) hash.update(name).update(readFileSync(join(root, name)));
  return hash.digest("hex");
};
