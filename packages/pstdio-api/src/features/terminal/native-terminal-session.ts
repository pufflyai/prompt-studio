import { getCommandValue } from "@pstdio/sdk/extensions";
import type { TerminalSessionHandle, TerminalViewOpenRequest } from "pstdio-api-contracts";
import { extensionResourceRefSchema } from "pstdio-api-contracts";
import { z } from "zod";
import { resolveLocalWorkspaceTarget } from "../extensions/command-environment/workspace-target";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import {
  type ProjectExtensionRuntimeSnapshot,
  resolveEnabledSourceForRecord,
} from "../extensions/project-extension-runtime-snapshot";

const size = z.number().int().positive().max(65535);
export const nativeTerminalOpenSchema = z
  .object({
    projectId: z.string().min(1),
    viewId: z.string().min(1),
    resource: extensionResourceRefSchema.optional(),
    cols: size,
    rows: size,
  })
  .strict();
const sessionSchema = z
  .object({
    workspaceId: z.string().min(1).optional(),
    command: z.array(z.string()).min(1).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict();
const installedOwnerKey = (snapshot: ProjectExtensionRuntimeSnapshot, sourcePath: string) => {
  const source = resolveEnabledSourceForRecord(sourcePath, snapshot.enabledSources, snapshot.runtime.extensions);
  return JSON.stringify([
    source?.installedSource.source_path ?? sourcePath,
    source?.instance.id,
    source?.installedSource.id,
  ]);
};

/** Resolve executable settings on the host, then transfer PTY lifetime to the presentation's socket. */
export const openNativeTerminalSession = async (
  deps: ExtensionsRouteDeps,
  request: TerminalViewOpenRequest,
  signal: AbortSignal,
) => {
  const { projectId, viewId, resource, cols, rows } = nativeTerminalOpenSchema.parse(request);
  if (resource?.projectId && resource.projectId !== projectId)
    throw new Error("Terminal resource belongs to another project");
  if (!deps.terminal) throw new Error("Terminal sessions are not available on this host");
  signal.throwIfAborted();
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  signal.throwIfAborted();
  const view = snapshot.runtime.views.find((candidate) => candidate.id === viewId);
  if (!view || view.contribution.body.kind !== "terminal")
    throw new Error("Native terminal view is not enabled in this project");
  const handler = snapshot.runtime.privateHandlers.find(
    (candidate) =>
      candidate.rendererId === viewId && candidate.rendererKind === "terminal" && candidate.operation === "session",
  );
  if (!handler || handler.extensionId !== view.extensionId)
    throw new Error("Native terminal view has no session callback");
  const installedOwner = installedOwnerKey(snapshot, view.sourcePath);

  const owner = new AbortController();
  const lifetime = AbortSignal.any([signal, owner.signal]);
  let session: TerminalSessionHandle | undefined;
  let closing: Promise<void> | undefined;
  let unsubscribe = () => {};
  const release = () => {
    unsubscribe();
    lifetime.removeEventListener("abort", onAbort);
  };
  const close = (stopSignal?: string) => {
    if (!closing) {
      release();
      closing = session?.kill(stopSignal) ?? Promise.resolve();
    }
    return closing;
  };
  const onAbort = () => {
    void close();
  };
  const validateOwner = async () => {
    const current = await deps.extensionRuntimeCatalog.get(projectId);
    const next = current.runtime.views.find((candidate) => candidate.id === viewId);
    if (
      !next ||
      next.extensionId !== view.extensionId ||
      next.contribution.body.kind !== "terminal" ||
      installedOwnerKey(current, next.sourcePath) !== installedOwner ||
      !current.runtime.privateHandlers.some(
        (candidate) => candidate.id === handler.id && candidate.extensionId === handler.extensionId,
      )
    )
      owner.abort(new Error("Native terminal owner was disposed"));
  };
  unsubscribe = deps.extensionRuntimeCatalog.subscribeInvalidation((event) => {
    if (event.projectId && event.projectId !== projectId) return;
    if (event.reason === "webviews_built") return;
    void validateOwner().catch((error) => owner.abort(error));
  });
  lifetime.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await executeProjectExtensionCommand(deps, {
      projectId,
      commandId: handler.id,
      signal: lifetime,
      body: {
        source: "dashboard",
        resource,
        params: { renderer: { rendererId: viewId, projectId, resource, invocation: { placement: "visible" } } },
      },
    });
    const launch = sessionSchema.parse(getCommandValue(response.outcome));
    await validateOwner();
    lifetime.throwIfAborted();
    const target = await resolveLocalWorkspaceTarget(deps, { projectId, workspaceId: launch.workspaceId }, "process");
    await validateOwner();
    lifetime.throwIfAborted();
    session = deps.terminal.openSession({ cols, rows, cwd: target.root, command: launch.command, env: launch.env });
    return {
      ...session,
      kill: close,
      events: async function* () {
        try {
          yield* session!.events();
        } finally {
          release();
        }
      },
    } satisfies TerminalSessionHandle;
  } catch (error) {
    release();
    throw error;
  }
};
