import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRegistryClient, parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { withFileMutationLock } from "pstdio-paths";
import { parseExtensionSourceRef } from "../../services/extension-source-ref";
import { copyExtensionSource } from "./copy-extension-source";
import { isSameDirectory } from "./extension-install-paths";
import { prepareReleaseExtensionSource } from "./extension-source-checkout";
import { fingerprintUpgradeWorkingTree } from "./extension-upgrade-working-tree";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";
import type { resolveInstallSource } from "./resolve-install-source";

export class ExtensionUpgradeNeedsReviewError extends Error {
  constructor(message = "This extension has local changes and could not be updated.") {
    super(message);
    this.name = "ExtensionUpgradeNeedsReviewError";
  }
}

const hashPattern = /^[a-f0-9]{64}$/;
const baselinePath = (home: string, ref: string) => {
  const key = createHash("sha256").update(ref).digest("hex");
  return join(home, "cache", "extension-upgrade-baselines", key);
};

/** A legacy install can lose its source ref during folder discovery. Only accept an
 * exact fingerprint previously recorded from a release, including package identity,
 * version, file modes and lockfile. Never learn a baseline from the installed copy. */
export const rememberedReleaseFingerprint = (home: string, path: string) => {
  try {
    const directory = join(home, "cache", "extension-upgrade-baselines");
    if (!lstatSync(path).isDirectory()) return undefined;
    const fingerprint = fingerprintUpgradeWorkingTree(path);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        hashPattern.test(entry.name) &&
        readFileSync(join(directory, entry.name), "utf8") === fingerprint
      )
        return fingerprint;
    }
  } catch {
    // An unreadable cache or working tree cannot prove the source is unchanged.
  }
  return undefined;
};

const readBaseline = (home: string, ref: string) => {
  try {
    const value = readFileSync(baselinePath(home, ref), "utf8");
    return hashPattern.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const rememberExtensionUpgradeBaseline = (home: string, ref: string, sourcePath: string) => {
  const path = baselinePath(home, ref);
  if (readBaseline(home, ref)) return;
  try {
    const fingerprint = fingerprintUpgradeWorkingTree(sourcePath);
    mkdirSync(dirname(path), { recursive: true });
    withFileMutationLock(path, () => {
      if (readBaseline(home, ref)) return;
      const stage = `${path}.${crypto.randomUUID()}.tmp`;
      try {
        writeFileSync(stage, fingerprint, { flag: "wx" });
        renameSync(stage, path);
      } finally {
        rmSync(stage, { force: true });
      }
    });
  } catch {
    // A later upgrade can recover the original source by its exact ref.
  }
};

export const recoverExtensionUpgradeBaseline = async (ref: string, tempDir: string, signal?: AbortSignal) => {
  const registry = parseRegistrySourceRef(ref);
  if (registry) {
    const client = createRegistryClient(registry.registry);
    const exact = (await client.versions(registry.id, signal)).find((release) => release.version === registry.version);
    if (exact) return (await client.prepare(exact, join(tempDir, "registry"), signal)).path;
  }
  const git = parseExtensionSourceRef(ref);
  if (!git) return undefined;
  const source = await prepareReleaseExtensionSource(
    { kind: "git", url: git.url, path: git.path, ref: git.commit },
    tempDir,
    git.commit,
    signal,
  );
  return source.ref === ref ? source.path : undefined;
};

export class ExtensionUpgradeLocalEditsError extends ExtensionUpgradeNeedsReviewError {
  constructor() {
    super();
    this.name = "ExtensionUpgradeLocalEditsError";
  }
}

export const assertExtensionUpgradeWorkingTree = (
  path: string,
  baseline: string,
  options?: Parameters<typeof fingerprintUpgradeWorkingTree>[1],
) => {
  let current: string | undefined;
  try {
    current = fingerprintUpgradeWorkingTree(path, options);
  } catch {
    // An unreadable or incomplete tree cannot establish a safe replacement.
  }
  if (!current) throw new ExtensionUpgradeNeedsReviewError("The local extension could not be verified.");
  if (baseline !== current) throw new ExtensionUpgradeLocalEditsError();
};

const requireExtensionUpgradeBaseline = async (
  home: string,
  source: NonNullable<InstallExtensionSourceInput["upgradeBase"]>,
  tempDir: string,
  signal?: AbortSignal,
) => {
  let baseline = source.ref ? readBaseline(home, source.ref) : source.rememberedFingerprint;
  if (!baseline && source.ref) {
    try {
      const recovered = await recoverExtensionUpgradeBaseline(source.ref, tempDir, signal);
      if (recovered) {
        const original = join(tempDir, "original-working-tree");
        await copyExtensionSource(recovered, original);
        baseline = fingerprintUpgradeWorkingTree(original);
        rememberExtensionUpgradeBaseline(home, source.ref, original);
      }
    } catch {
      signal?.throwIfAborted();
    }
  }
  if (!baseline) {
    throw new ExtensionUpgradeNeedsReviewError(
      "The original release could not be verified. The local extension was kept.",
    );
  }
  assertExtensionUpgradeWorkingTree(source.path, baseline);
  return baseline;
};

export const prepareExtensionUpgradeBaseline = (
  home: string,
  upgradeBase: InstallExtensionSourceInput["upgradeBase"],
  tempDir: string,
  signal?: AbortSignal,
) => upgradeBase && requireExtensionUpgradeBaseline(home, upgradeBase, join(tempDir, "upgrade-base"), signal);

export const protectUpgradeDestination = (
  upgradeBase: InstallExtensionSourceInput["upgradeBase"],
  targetPath: string,
  replacingExisting: boolean,
) => {
  if (upgradeBase && (!replacingExisting || !isSameDirectory(upgradeBase.path, targetPath))) {
    throw new ExtensionUpgradeNeedsReviewError(
      "The incoming release changes the source location. The local extension was kept.",
    );
  }
};

export const stageExtensionSource = async (
  source: Awaited<ReturnType<typeof resolveInstallSource>>,
  stagePath: string,
  home: string,
) => {
  await copyExtensionSource(source.path, stagePath);
  if (source.kind === "named") rememberExtensionUpgradeBaseline(home, source.ref, stagePath);
};
