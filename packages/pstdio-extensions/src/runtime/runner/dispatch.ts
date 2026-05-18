import type {
  CommandLifecyclePhase,
  CommandRef,
  EventContext,
  EventDeliveryResult,
  EventReject,
  EventRef,
  ExtensionLoggerApi,
  Struct,
} from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, NormalizedExtension, RuntimeHookRecord } from "../../types/runtime";
import type { BuildEnvironmentInput, CommandRunnerHostDeps } from "./types";

export const refId = (ref: CommandRef | EventRef | string): string => (typeof ref === "string" ? ref : ref.id);

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

type DispatchOutcome =
  | { status: "delivered" }
  | { status: "skipped" }
  | { status: "rejected"; rejection: NonNullable<EventDeliveryResult["rejection"]> }
  | { status: "failed"; diagnostic: NonNullable<EventDeliveryResult["diagnostics"]>[number] };

const findExtension = (runtime: ExtensionRuntime, id: string): NormalizedExtension | undefined =>
  runtime.extensions.find((ext) => ext.id === id);

const isReject = (value: unknown): value is EventReject =>
  Boolean(value) && typeof value === "object" && (value as EventReject).type === "reject";

const deliverToHook = async (
  sub: RuntimeHookRecord,
  eventId: string,
  payload: Struct,
  input: DispatcherDeps,
): Promise<DispatchOutcome> => {
  const ext = findExtension(input.runtime, sub.extensionId);
  if (!ext) return { status: "skipped" };

  try {
    const ctx = await input.buildEventContext(
      {
        projectId: (payload as { projectId?: string })?.projectId ?? "",
        extensionId: sub.extensionId,
        name: sub.name,
      },
      eventId,
      input.generateId(),
    );

    const result = await sub.handler(ctx, payload);
    if (isReject(result)) {
      return {
        status: "rejected",
        rejection: {
          extensionId: sub.extensionId,
          hookId: sub.id,
          code: result.code,
          reason: result.reason,
          data: result.data,
        },
      };
    }
    return { status: "delivered" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    input.logger.warn(`Hook "${sub.id}" failed: ${message}`, { eventId });
    return {
      status: "failed",
      diagnostic: {
        code: "hook_failed",
        message: `Hook "${sub.id}" threw: ${message}`,
        severity: "warning",
        extensionId: sub.extensionId,
        metadata: { eventId },
      },
    };
  }
};

export const createEventDispatcher = (input: DispatcherDeps): EventDispatcher => {
  const dispatch = async (eventId: string, payload: Struct): Promise<EventDeliveryResult> => {
    const subs = input.runtime.hooks.filter((h) => h.eventId === eventId);
    let delivered = 0;
    let rejection: EventDeliveryResult["rejection"];
    const diagnostics: NonNullable<EventDeliveryResult["diagnostics"]> = [];

    for (const sub of subs) {
      const outcome = await deliverToHook(sub, eventId, payload, input);
      if (outcome.status === "delivered") delivered += 1;
      else if (outcome.status === "failed") diagnostics.push(outcome.diagnostic);
      else if (outcome.status === "rejected") {
        delivered += 1;
        rejection = outcome.rejection;
        break;
      }
    }

    const result: EventDeliveryResult = { delivered };
    if (diagnostics.length > 0) result.diagnostics = diagnostics;
    if (rejection) result.rejection = rejection;
    return result;
  };

  return { dispatch };
};
