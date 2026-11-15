import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { join, relative } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import {
  inspectManagedWebviewBuildInputs,
  missingWebviewDependenciesError,
  prepareManagedWebviewBuildSource,
} from "./extension-webview-build-source";
import { trackPreparationStage } from "./preparation-stages";
import { inspectWebviewDependencyInputs } from "./webview-input-inspection";

type Input = Parameters<typeof inspectManagedWebviewBuildInputs>[0];

// Fingerprint the same source and resolution context the compiler will use. A
// repository fallback changes compiler configuration and transitive resolution,
// so hashing only its dependency manifests cannot establish the output identity.
export const inspectPreparedWebviewInputs = async (
  inputs: Input[],
  sourceRoot: string,
  signal?: AbortSignal,
  selections = inputs.map((input) => inspectManagedWebviewBuildInputs(input, "")),
) => {
  const shells = new Map<string, string>();
  const sources = inputs.map((input, index) => {
    signal?.throwIfAborted();
    const selected = selections[index]!;
    const error = missingWebviewDependenciesError(selected, input.packagePath);
    if (error) throw new Error(error);
    const dependencyRoot = selected.dependencyNodeModules;
    if (!selected.dependencyNames.length || dependencyRoot === join(input.packagePath, "node_modules")) return input;
    let packagePath = shells.get(dependencyRoot!);
    if (!packagePath) {
      packagePath = join(sourceRoot, `source-${shells.size}`);
      const source = prepareManagedWebviewBuildSource({ ...input, buildInputs: selected, shellDir: packagePath });
      if (!source.success) throw new Error(source.details);
      shells.set(dependencyRoot!, packagePath);
    }
    return { ...input, packagePath, entryPath: join(packagePath, relative(input.packagePath, input.entryPath)) };
  });
  const groups = new Map<string, string[]>();
  for (const source of sources) {
    const entries = groups.get(source.packagePath) ?? [];
    entries.push(source.entryPath);
    groups.set(source.packagePath, entries);
  }
  const inspected = await Promise.allSettled(
    [...groups].map(([path, entries]) => inspectWebviewDependencyInputs(path, entries, signal)),
  );
  signal?.throwIfAborted();
  const digests = inspected.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  const dependencyHash =
    digests.length === 1
      ? digests[0]!
      : createHash("sha256")
          .update(JSON.stringify(digests))
          .update(JSON.stringify(sources.map((source) => [...groups.keys()].indexOf(source.packagePath))))
          .digest("hex");
  return {
    sources,
    signatures: inputs.map((input) => inspectManagedWebviewBuildInputs(input, dependencyHash)),
  };
};

export const inspectSinglePreparedWebviewInputs = async (input: Input, signal?: AbortSignal) => {
  const selected = inspectManagedWebviewBuildInputs(input, "");
  if (
    selected.dependencyNames.length &&
    selected.dependencyNodeModules &&
    selected.dependencyNodeModules !== join(input.packagePath, "node_modules")
  ) {
    const root = join(resolvePstdioHome(), "cache", "prepared-webviews", `inspection-${crypto.randomUUID()}`);
    const stage = trackPreparationStage([root]);
    try {
      return (await inspectPreparedWebviewInputs([input], root, signal, [selected])).signatures[0]!;
    } finally {
      rmSync(root, { recursive: true, force: true });
      stage.release();
    }
  }
  return inspectManagedWebviewBuildInputs(
    input,
    await inspectWebviewDependencyInputs(input.packagePath, [input.entryPath], signal),
  );
};
