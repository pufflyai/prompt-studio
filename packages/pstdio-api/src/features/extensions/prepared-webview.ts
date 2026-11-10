import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { retainPreparedArtifacts } from "pstdio-extensions/prepared-cache";
import { resolvePstdioHome, withFileMutationLock } from "pstdio-paths";
import {
  inspectManagedWebviewBuildInputs,
  inspectManagedWebviewBuildInputsAsync,
  type ManagedWebviewBuildInputs,
  missingWebviewDependenciesError,
  prepareManagedWebviewBuildSource,
} from "./extension-webview-build-source";
import {
  buildExtensionWebview,
  buildExtensionWebviewBatch,
  extensionWebviewBuildOptions,
} from "./extension-webview-builder";
import { inspectWebviewDependencyInputs } from "./webview-input-inspection";

export const prepareWebviewArtifact = async (
  input: {
    entryPath: string;
    packagePath: string;
    packageName: string;
    installName: string;
    buildInputs?: ManagedWebviewBuildInputs;
  },
  signal: AbortSignal,
) => {
  // The manager already inspected this candidate. Reuse those bytes for its identity;
  // the fresh post-build inspection below still rejects edits before publication.
  const buildInputs = input.buildInputs ?? (await inspectManagedWebviewBuildInputsAsync(input, signal));
  signal.throwIfAborted();
  const id = createHash("sha256")
    .update([buildInputs.signature, Bun.version, JSON.stringify(extensionWebviewBuildOptions)].join("\0"))
    .digest("hex");
  const root = join(resolvePstdioHome(), "cache", "prepared-webviews", id);
  const distDir = join(root, "dist");
  const complete = join(root, "complete.json");
  try {
    if (JSON.parse(readFileSync(complete, "utf8")).id === id && existsSync(join(distDir, "module.js"))) {
      retainPreparedArtifacts(undefined, [id]);
      return { success: true as const, id, distDir };
    }
  } catch {}
  const stage = join(root, `staging-${crypto.randomUUID()}`);
  mkdirSync(stage, { recursive: true });
  try {
    const source = prepareManagedWebviewBuildSource({ ...input, buildInputs, shellDir: join(stage, "source") });
    if (!source.success) throw new Error(source.details);
    const outcome = await buildExtensionWebview({ entryPath: source.entryPath, outdir: join(stage, "dist"), signal });
    if (!outcome.success) throw new Error(outcome.details);
    await Bun.sleep(0);
    signal.throwIfAborted();
    const after = await inspectManagedWebviewBuildInputsAsync(input, signal);
    signal.throwIfAborted();
    if (after.signature !== buildInputs.signature)
      throw new Error("Extension webview changed while preparing its bundle.");
    rmSync(distDir, { recursive: true, force: true });
    renameSync(join(stage, "dist"), distDir);
    writeFileSync(complete, JSON.stringify({ id }));
    retainPreparedArtifacts(undefined, [id]);
    return { success: true as const, id, distDir };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
};

type WebviewArtifactInput = Parameters<typeof prepareWebviewArtifact>[0];
const dependencyHashForViews = (packagePath: string, inputs: WebviewArtifactInput[], signal: AbortSignal) =>
  inspectWebviewDependencyInputs(
    packagePath,
    inputs.map((input) => input.entryPath),
    signal,
  );
const artifactPaths = (id: string) => {
  const root = join(resolvePstdioHome(), "cache", "prepared-webviews", id);
  return { id, root, distDir: join(root, "dist"), complete: join(root, "complete.json") };
};
const isCompleteArtifact = (artifact: ReturnType<typeof artifactPaths>) => {
  try {
    return (
      JSON.parse(readFileSync(artifact.complete, "utf8")).id === artifact.id &&
      existsSync(join(artifact.distDir, "module.js"))
    );
  } catch {
    return false;
  }
};
// One child builds a candidate's managed views together. Shared dependencies are inspected
// once per package and common frontend modules are compiled once rather than once per view.
export const prepareWebviewArtifacts = async (inputs: WebviewArtifactInput[], signal: AbortSignal) => {
  if (!inputs.length) return [];
  const packagePath = inputs[0]!.packagePath;
  if (inputs.some((input) => input.packagePath !== packagePath))
    throw new Error("Webview batch must belong to one package.");
  const dependencyHash = await dependencyHashForViews(packagePath, inputs, signal);
  signal.throwIfAborted();
  const signatures = inputs.map((input) => inspectManagedWebviewBuildInputs(input, dependencyHash));
  for (const signature of signatures) {
    const error = missingWebviewDependenciesError(signature, packagePath);
    if (error) throw new Error(error);
  }
  const artifacts = signatures.map((signature) =>
    artifactPaths(
      createHash("sha256")
        .update([signature.signature, Bun.version, JSON.stringify(extensionWebviewBuildOptions)].join("\0"))
        .digest("hex"),
    ),
  );
  const missing = artifacts
    .map((artifact, index) => ({ artifact, index }))
    .filter(({ artifact }) => !isCompleteArtifact(artifact));
  if (!missing.length) {
    retainPreparedArtifacts(
      undefined,
      artifacts.map((artifact) => artifact.id),
    );
    return artifacts;
  }
  const batch = join(resolvePstdioHome(), "cache", "prepared-webviews", `batch-${crypto.randomUUID()}`);
  mkdirSync(batch, { recursive: true });
  try {
    const entries = missing.map(({ index }) => {
      const entry = join(batch, `entry-${index}.ts`);
      const target = JSON.stringify(inputs[index]!.entryPath);
      writeFileSync(
        entry,
        `export * from ${target}; import * as original from ${target}; export default original["default"];`,
      );
      return entry;
    });
    const outcome = await buildExtensionWebviewBatch({ entryPaths: entries, outdir: join(batch, "dist"), signal });
    if (!outcome.success) throw new Error(outcome.details);
    signal.throwIfAborted();
    const afterHash = await dependencyHashForViews(packagePath, inputs, signal);
    signal.throwIfAborted();
    if (
      inputs.some(
        (input, index) => inspectManagedWebviewBuildInputs(input, afterHash).signature !== signatures[index]!.signature,
      )
    )
      throw new Error("Extension webview changed while preparing its bundle.");
    for (const { artifact, index } of missing) {
      mkdirSync(artifact.root, { recursive: true });
      const stage = join(artifact.root, `staging-${crypto.randomUUID()}`);
      cpSync(join(batch, "dist"), stage, { recursive: true });
      copyFileSync(join(stage, `entry-${index}.js`), join(stage, "module.js"));
      withFileMutationLock(artifact.complete, () => {
        if (!isCompleteArtifact(artifact)) {
          rmSync(artifact.distDir, { recursive: true, force: true });
          renameSync(stage, artifact.distDir);
          writeFileSync(artifact.complete, JSON.stringify({ id: artifact.id }));
        }
      });
      rmSync(stage, { recursive: true, force: true });
    }
    retainPreparedArtifacts(
      undefined,
      artifacts.map((artifact) => artifact.id),
    );
    return artifacts;
  } finally {
    rmSync(batch, { recursive: true, force: true });
  }
};
