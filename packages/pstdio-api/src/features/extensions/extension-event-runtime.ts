import type { EventRef, JsonObject, Struct } from "@pstdio/sdk/extensions";
import { createCommandRunner } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "./deps";
import { createCommandEnvironment, loadProjectExtensionRuntime } from "./extension-command-runtime";

type ExtensionEventDeps = Pick<
  ExtensionsRouteDeps,
  | "activityEventsService"
  | "extensionService"
  | "extensionStorageService"
  | "fileService"
  | "repoService"
  | "sessionService"
  | "statusService"
  | "ticketService"
  | "workspaceService"
>;

const eventIdFor = (event: EventRef | string) => (typeof event === "string" ? event : event.id);

export const fireExtensionEvent = async <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  event: EventRef<TPayload> | string,
  payload: TPayload,
) => {
  const { enabledSources, runtime } = await loadProjectExtensionRuntime(deps as ExtensionsRouteDeps, projectId);
  const runner = createCommandRunner(runtime, {
    buildEnvironment: (input) =>
      createCommandEnvironment(deps as ExtensionsRouteDeps, enabledSources, {
        extensionId: input.extensionId,
        name: input.name,
        projectId: input.projectId,
      }),
  });

  return runner.dispatchEvent({
    eventId: eventIdFor(event),
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
  void fireExtensionEvent(deps, projectId, event, payload).catch(() => {});
};
