import type {
  CommandLifecyclePhase,
  CommandRef,
  EventContext,
  EventDeliveryResult,
  EventRef,
  ExtensionLoggerApi,
  Struct,
} from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, NormalizedExtension } from "../../types/runtime";
import type { BuildEnvironmentInput, CommandRunnerHostDeps } from "./types";

export const refId = (ref: CommandRef | EventRef | string, ownerExtensionId?: string): string => {
  if (typeof ref === "string") return ref;
  const extensionId = ref.extensionId ?? ownerExtensionId;
  // Host-owned refs (extensionId "pstdio") resolve to the host's registered id without
  // owner prefixing — the same rule normalize/references.ts applies.
  if (!extensionId || extensionId === "pstdio") return ref.id;
  if (ref.kind === "command") return `${extensionId}.command.${ref.id}`;
  const lifecycleMatch = /^(command\.(?:requested|started|completed|rejected|failed):)(.+)$/.exec(ref.id);
  if (lifecycleMatch) {
    return `${lifecycleMatch[1]}${extensionId}.command.${lifecycleMatch[2]}`;
  }
  return `${extensionId}.event.${ref.id}`;
};

export const lifecycleEventId = (phase: CommandLifecyclePhase, commandId: string) => `command.${phase}:${commandId}`;

export interface EventDispatcher {
  dispatch(eventId: string, payload: Struct): Promise<EventDeliveryResult>;
}

export interface DispatcherDeps {
  runtime: ExtensionRuntime;
  deps: CommandRunnerHostDeps;
  generateId: () => string;
  logger: ExtensionLoggerApi;
  buildEventContext: (input: BuildEnvironmentInput, eventId: string, deliveryId: string) => Promise<EventContext>;
}

const findExtension = (runtime: ExtensionRuntime, id: string): NormalizedExtension | undefined =>
  runtime.extensions.find((ext) => ext.id === id);

export const createEventDispatcher = (input: DispatcherDeps): EventDispatcher => {
  const dispatch = async (eventId: string, payload: Struct): Promise<EventDeliveryResult> => {
    const subs = input.runtime.hooks.filter((h) => h.eventId === eventId);
    let delivered = 0;
    const diagnostics: NonNullable<EventDeliveryResult["diagnostics"]> = [];

    for (const sub of subs) {
      const ext = findExtension(input.runtime, sub.extensionId);
      if (!ext) continue;

      try {
        const workspaceDir = (payload as { workspaceDir?: string }).workspaceDir;
        const workspaceId = (payload as { workspaceId?: string }).workspaceId;
        const ctx = await input.buildEventContext(
          {
            projectId: (payload as { projectId?: string })?.projectId ?? "",
            extensionId: sub.extensionId,
            name: sub.name,
            workspaceDir,
            workspaceId,
          },
          eventId,
          input.generateId(),
        );

        await sub.handler(ctx, payload);
        delivered += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        diagnostics.push({
          code: "hook_failed",
          message: `Hook "${sub.id}" threw: ${message}`,
          severity: "warning",
          extensionId: sub.extensionId,
          metadata: { eventId },
        });
        input.logger.warn(`Hook "${sub.id}" failed: ${message}`, { eventId });
      }
    }

    input.deps.onDidDispatchEvent?.(eventId);

    return diagnostics.length > 0 ? { delivered, diagnostics } : { delivered };
  };

  return { dispatch };
};
