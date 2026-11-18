import type { createAppDatabaseServices } from "./app-database";
import type { RouteDeps } from "./features/deps";
import { validateLegacyAnchors } from "./features/extensions/command-environment/resource-link-policy";
import { createSessionQueueLifecycle } from "./features/sessions/session-queue-lifecycle";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import type { EventBus } from "./features/sync/event-bus";
import { createSessionLifecycleCallbacks } from "./services/session-lifecycle-callbacks";
import { createSessionService } from "./services/session-service";

export const createAppSessions = (input: {
  sessionsDBService: ReturnType<typeof createAppDatabaseServices>["sessionsDBService"];
  eventBus: EventBus;
  deps: () => RouteDeps;
}) => {
  const { sessionsDBService, eventBus, deps } = input;
  const sessionQueueLifecycle = createSessionQueueLifecycle();
  const sessionHooks = createSessionLifecycleCallbacks(deps);
  let drainSessionQueue: (input?: { releasedSessionId?: string }) => Promise<void> = async () => {};
  const sessionService = createSessionService({
    sessionsDb: sessionsDBService,
    validateCreatedAnchors: (source, anchors) => validateLegacyAnchors(deps(), source, anchors),
    eventBus,
    ...sessionHooks,
    onCapacityAvailable: (input) => drainSessionQueue(input),
    onIdleTurn: (sessionId) => deliverIdleTurn(sessionId),
  });
  let deliverIdleTurn: (sessionId: string) => Promise<void> = async () => {};
  return {
    sessionQueueLifecycle,
    sessionService,
    closeHooks: sessionHooks.close,
    drainSessionQueue: () => drainSessionQueue(),
    connectQueueDrain() {
      drainSessionQueue = (input) => createSessionScheduler(deps()).drainQueue(input);
    },
    connectIdleTurn(handler: typeof deliverIdleTurn) {
      deliverIdleTurn = handler;
    },
    deliverIdleTurn: (sessionId: string) => deliverIdleTurn(sessionId),
  };
};
