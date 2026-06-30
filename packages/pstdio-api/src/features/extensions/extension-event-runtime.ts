import type { EventRef, ExtensionLoggerApi, JsonObject, Struct } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import type { ExtensionsRouteDeps } from "./deps";
import { createCommandEnvironment, loadProjectExtensionRuntime } from "./extension-command-runtime";

export type ExtensionEventDeps = ExtensionsRouteDeps;

const eventIdFor = (event: EventRef | string) => (typeof event === "string" ? event : event.id);

const extensionEventLogger: ExtensionLoggerApi = {
  info: (message, metadata) => {
    apiLogger.info({ event: "extension.event.log", metadata: metadata ?? {} }, message);
  },
  warn: (message, metadata) => {
    apiLogger.warn({ event: "extension.event.log", metadata: metadata ?? {} }, message);
  },
  error: (message, metadata) => {
    apiLogger.error({ event: "extension.event.log", metadata: metadata ?? {} }, message);
  },
};

export const fireExtensionEvent = async <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  event: EventRef<TPayload> | string,
  payload: TPayload,
) => {
  const eventId = eventIdFor(event);
  const { enabledSources, project, runtime } = await loadProjectExtensionRuntime(deps, projectId);
  const runner = createCommandRunner(runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps, enabledSources, {
        artifactMounts: runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        project,
        projectId: input.projectId,
        repo: input.repo,
        settings: runtime.settings,
      }),
  });

  return runner.dispatchEvent({
    eventId,
    projectId,
    payload: payload as JsonObject,
  });
};

export const fireExtensionEventAsync = <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  event: EventRef<TPayload> | string,
  payload: TPayload,
) => {
  const eventId = eventIdFor(event);
  void fireExtensionEvent(deps, projectId, event, payload).catch((err) => {
    apiLogger.warn(
      { err, event: "extension.event.dispatch_failed", event_id: eventId, project_id: projectId },
      "Extension event dispatch failed",
    );
  });
};
