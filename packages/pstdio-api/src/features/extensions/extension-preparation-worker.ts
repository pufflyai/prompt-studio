import {
  createPreparationHandler,
  serializePreparationError,
  startPreparationWorker,
} from "pstdio-extensions/preparation-server";
import { runtimePreparationTasks } from "pstdio-extensions/preparation-worker";
import { traceSetupPhase } from "../../lib/setup-phase";
import { listExtensionSourcesInWorker } from "./discover-extension-sources";
import { validateCandidateInWorker } from "./extension-candidate";
import { extensionInstallConcurrency } from "./extension-install-concurrency";
import {
  activatePreparedInstall,
  assertPreparedInstallOwned,
  recoverPreparedInstalls,
  settlePreparedInstall,
} from "./extension-install-transaction";
import { checkExtensionSource, checkExtensionsRoot } from "./extension-runtime";
import { createSharedNamedSourceCheckout } from "./extension-source-checkout";
import {
  inspectManagedWebviewBuildInputsAsync,
  prepareManagedWebviewBuildSource,
} from "./extension-webview-build-source";
import { buildExtensionWebview } from "./extension-webview-builder";
import { inspectWebviewLoadKeyInWorker, inspectWebviewSourceInWorker } from "./extension-webview-source-inspection";
import { installExtensionSource } from "./install-extension-source";
import { disposePreparationStage, recoverPreparationStages } from "./preparation-stages";
import {
  disposePreparationWatcher,
  disposePreparationWatchers,
  updatePreparationWatcher,
} from "./preparation-watchers";
import { prepareWebviewArtifact, prepareWebviewArtifacts } from "./prepared-webview";
import { type PreparePublishedInput, preparePublishedExtension } from "./publication/prepare";

const prepareCheckout = async (
  input: {
    names: string[];
    id: string;
    options: { ref?: string; hostReleaseRef?: string };
  },
  signal: AbortSignal,
) => {
  const checkout = await createSharedNamedSourceCheckout(input.names, { ...input.options, signal, leaseId: input.id });
  try {
    const sources: Record<string, { path: string; ref: string }> = {};
    for (const name of input.names)
      sources[name] = await checkout.prepareNamedSource(name, "", input.options.ref, signal);
    checkout.retain?.();
    return { id: input.id, sources };
  } catch (error) {
    checkout.cleanup();
    throw error;
  }
};
const handle = createPreparationHandler({
  ...runtimePreparationTasks,
  "lifecycle.cleanup": async () => {
    await recoverPreparedInstalls(true);
    recoverPreparationStages(true);
  },
  "source.list": listExtensionSourcesInWorker,
  "published.prepare": async (
    input: Omit<PreparePublishedInput, "bytes" | "signal"> & { bytes: ArrayBuffer },
    signal: AbortSignal,
  ) =>
    JSON.parse(
      JSON.stringify(await preparePublishedExtension({ ...input, bytes: new Blob([input.bytes]), signal })),
    ) as Awaited<ReturnType<typeof preparePublishedExtension>>,
  "source.check": async (input: {
    sourcePath: string;
    extensionsRoot: string;
    options?: Parameters<typeof checkExtensionSource>[2];
  }) =>
    JSON.parse(
      JSON.stringify(await checkExtensionSource(input.sourcePath, input.extensionsRoot, input.options)),
    ) as Awaited<ReturnType<typeof checkExtensionSource>>,
  "source.check-root": async (input: { extensionsRoot: string; options?: Parameters<typeof checkExtensionsRoot>[1] }) =>
    JSON.parse(JSON.stringify(await checkExtensionsRoot(input.extensionsRoot, input.options))) as Awaited<
      ReturnType<typeof checkExtensionsRoot>
    >,
  "source.inspect": inspectWebviewSourceInWorker,
  "source.webview-key": inspectWebviewLoadKeyInWorker,
  "source.validate": validateCandidateInWorker,
  "checkout.shared": prepareCheckout,
  "checkout.dispose": (input: { id: string }) => {
    disposePreparationStage(input.id);
  },
  "watch.update": updatePreparationWatcher,
  "watch.dispose": (input: { id: string }) => disposePreparationWatcher(input.id),
  "install.settle": (input: { transaction: Parameters<typeof settlePreparedInstall>[0]; commit: boolean }) =>
    settlePreparedInstall(input.transaction, input.commit),
  "install.activate": (input: { transaction: Parameters<typeof activatePreparedInstall>[0] }) =>
    activatePreparedInstall(input.transaction),
  "install.assert": (input: { transaction: Parameters<typeof assertPreparedInstallOwned>[0] }) =>
    assertPreparedInstallOwned(input.transaction),
  "install.batch": async (inputs: Parameters<typeof installExtensionSource>[0][], signal: AbortSignal) => {
    const results = new Array<{ value: unknown } | { error: ReturnType<typeof serializePreparationError> }>(
      inputs.length,
    );
    let next = 0;
    await Promise.all(
      Array.from({ length: extensionInstallConcurrency }, async () => {
        while (next < inputs.length) {
          const index = next++;
          signal.throwIfAborted();
          try {
            results[index] = {
              value: JSON.parse(JSON.stringify(await installExtensionSource({ ...inputs[index]!, signal }))),
            };
          } catch (error) {
            results[index] = { error: serializePreparationError(error) };
          }
        }
      }),
    );
    return results;
  },
  install: async (input: Parameters<typeof installExtensionSource>[0], signal: AbortSignal) =>
    JSON.parse(JSON.stringify(await installExtensionSource({ ...input, signal }))) as Awaited<
      ReturnType<typeof installExtensionSource>
    >,
  "webview.inspect": (input, signal) => inspectManagedWebviewBuildInputsAsync(input, signal),
  "webview.prepare": prepareManagedWebviewBuildSource,
  "webview.artifact": prepareWebviewArtifact,
  "webview.artifacts": prepareWebviewArtifacts,
  "webview.build": (input: Parameters<typeof buildExtensionWebview>[0], signal: AbortSignal) =>
    buildExtensionWebview({ ...input, signal }),
});
const homes = new Set<string>();
startPreparationWorker(
  async (task, input, signal) => {
    const home = process.env.PSTDIO_HOME!;
    if (!homes.has(home)) {
      await recoverPreparedInstalls();
      recoverPreparationStages();
      homes.add(home);
    }
    return traceSetupPhase("extension.preparation", { task }, () => handle(task, input, signal));
  },
  async () => {
    disposePreparationWatchers();
  },
);
