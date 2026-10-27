import { join } from "node:path";
import { projectEvents } from "pstdio-api-contracts/extension-kernel";
import type { RouteDeps } from "./features/deps";
import { createArtifactMountWatchService } from "./features/extensions/artifact-mount-watch/watch-service";
import { fireExtensionEvent } from "./features/extensions/extension-event-runtime";
import { createExtensionScheduler } from "./features/extensions/extension-scheduler";
import { createTerminalSupervisor } from "./features/extensions/extension-terminal-runtime";
import type { RuntimeHost } from "./features/runtime/routes";
import { createBrowserSessions } from "./features/runtime/runtime-auth";
import { watchSessionQueueReadiness } from "./features/sessions/session-queue-readiness";
import { prepareQueuedSessionRecovery } from "./features/sessions/session-queue-recovery";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { prepareOrphanedSessionRecovery } from "./features/sessions/startup";
import { apiLogger } from "./lib/logger";
import type { createNotificationService } from "./services/notification-service";
import type { createProjectService } from "./services/project-service";
import type { createSessionService } from "./services/session-service";
import { runStartupTasks } from "./startup";

const EXTENSION_SCHEDULE_WATERMARK_FILE = "extension-schedule-watermarks.json";
const FATAL_CLOSE_TIMEOUT_MS = 5_000;

// Exiting while PGlite is open can corrupt its WAL (lessons 0002 and 0011), so a fatal exit waits
// for close. The deadline keeps a close that hangs from keeping a broken process alive.
export const closeBeforeFatalExit = async (close: () => Promise<void>, timeoutMs = FATAL_CLOSE_TIMEOUT_MS) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const closing = close().catch((err) =>
    apiLogger.error({ err, event: "api.fatal_close.error" }, "API failed to close before a fatal exit"),
  );
  await Promise.race([closing, deadline]);
  clearTimeout(timer);
};

export const createAppTerminalSupervisor = () =>
  createTerminalSupervisor({
    logger: {
      info: (message, metadata) =>
        apiLogger.info({ event: "extension.terminal.log", metadata: metadata ?? {} }, message),
      warn: (message, metadata) =>
        apiLogger.warn({ event: "extension.terminal.log", metadata: metadata ?? {} }, message),
      error: (message, metadata) =>
        apiLogger.error({ event: "extension.terminal.log", metadata: metadata ?? {} }, message),
    },
  });

export const createRuntimeRouteDeps = (input: {
  extensionScheduler: ReturnType<typeof createExtensionScheduler>;
  host: RuntimeHost | undefined;
  sessionService: ReturnType<typeof createSessionService>;
  terminalSupervisor: ReturnType<typeof createTerminalSupervisor>;
}) => {
  if (!input.host) return undefined;

  const activeSessions = async () => {
    const rows = await Promise.all(
      (["queued", "in_progress", "awaiting_input"] as const).map((status) => input.sessionService.listByStatus(status)),
    );
    return rows.flat().map((session) => ({ id: session.id, label: session.title }));
  };

  return {
    host: input.host,
    browserSessions: createBrowserSessions(),
    activity: async () => ({
      sessions: await activeSessions(),
      terminals: await input.terminalSupervisor.activity(),
      jobs: input.extensionScheduler.activity(),
    }),
    cancelActivity: async () => {
      const sessions = await activeSessions();
      await Promise.all(sessions.map((session) => input.sessionService.cancel(session.id)));
      await Promise.all([input.terminalSupervisor.dispose(), input.extensionScheduler.dispose()]);
    },
  };
};

export const startNotificationWakeTimer = (notificationService: ReturnType<typeof createNotificationService>) => {
  const timer = setInterval(() => {
    notificationService
      .wakeDueSnoozed()
      .catch((err) =>
        apiLogger.error({ err, event: "notifications.snooze_wakeup.error" }, "Failed to wake notifications"),
      );
  }, 30_000);
  timer.unref?.();
  return timer;
};

export const startAppExtensionScheduler = (
  deps: RouteDeps,
  projectService: ReturnType<typeof createProjectService>,
  storageRoot: string,
) =>
  createExtensionScheduler({
    deps,
    listProjectIds: async () => (await projectService.list()).map((project) => project.id),
    watermarkPath: join(storageRoot, EXTENSION_SCHEDULE_WATERMARK_FILE),
  });

export const startAppArtifactMountWatch = (deps: RouteDeps, projectService: ReturnType<typeof createProjectService>) =>
  createArtifactMountWatchService({
    deps,
    listProjectIds: async () => (await projectService.list()).map((project) => project.id),
  });

const createAppCloser = (input: {
  startupAbort: AbortController;
  startupDone: Promise<void>;
  getStartupBackgroundDone: () => Promise<void>;
  notificationWakeTimer: ReturnType<typeof setInterval>;
  unsubscribeExtensionEvents: () => void;
  extensionRuntime: { dispose(): Promise<void> };
  extensionScheduler: { dispose(): Promise<void> };
  artifactMountWatch: { dispose(): Promise<void> };
  automationService: { close(): Promise<void> };
  terminalSupervisor: { dispose(): Promise<void> };
  closeDb: () => Promise<void>;
  closeSessionHooks: () => Promise<void>;
  stopQueueReadiness: () => Promise<void>;
  sessionQueueLifecycle: RouteDeps["sessionQueueLifecycle"];
  harnessRegistry: RouteDeps["harnessRegistry"];
  nativeDocuments: Pick<RouteDeps["nativeDocuments"], "dispose">;
}) => {
  let closePromise: Promise<void> | null = null;
  return async () => {
    closePromise ??= (async () => {
      const hooksStopped = input.closeSessionHooks();
      const nativeDocumentsStopped = input.nativeDocuments.dispose();
      try {
        input.startupAbort.abort();
        const queueStopped = input.sessionQueueLifecycle.close();
        // A queued startup can need worker disposal to settle. Stop admission first,
        // then begin cleanup before waiting for those dispatches to finish.
        const harnessesStopped = input.harnessRegistry.dispose();
        harnessesStopped.catch(() => {});
        await input.stopQueueReadiness();
        await queueStopped;
        await input.startupDone;
        await input.getStartupBackgroundDone();
        await hooksStopped;
        await nativeDocumentsStopped;
        clearInterval(input.notificationWakeTimer);
        input.unsubscribeExtensionEvents();
        await input.extensionRuntime.dispose();
        await input.artifactMountWatch.dispose();
        await input.extensionScheduler.dispose();
        await input.automationService.close();
        await input.terminalSupervisor.dispose();
        await harnessesStopped;
      } finally {
        // A part that fails to stop must not leave PGlite open (lessons 0002 and 0011).
        try {
          await hooksStopped;
        } finally {
          try {
            await nativeDocumentsStopped;
          } finally {
            await input.closeDb();
          }
        }
      }
    })();
    await closePromise;
  };
};

export const startAppLifecycle = async (input: {
  deps: RouteDeps;
  notificationWakeTimer: ReturnType<typeof setInterval>;
  unsubscribeExtensionEvents: () => void;
  extensionRuntime: { dispose(): Promise<void> };
  extensionStartup: Promise<void>;
  extensionScheduler: { dispose(): Promise<void> };
  artifactMountWatch: { dispose(): Promise<void> };
  automationService: Pick<RouteDeps["automationService"], "close" | "recoverQueuedRuns">;
  terminalSupervisor: { dispose(): Promise<void> };
  closeDb: () => Promise<void>;
  closeSessionHooks: () => Promise<void>;
}) => {
  const unsubscribeProjectActivation = input.deps.extensionRuntimeCatalog.subscribeActivation((projectId) =>
    fireExtensionEvent(input.deps, projectId, projectEvents.opened, { projectId }),
  );
  const startupAbort = new AbortController();
  // Only sessions present before admission belong to restart recovery. Harness
  // discovery and reattachment can finish later without claiming new requests.
  const [recoverOrphanedSessions, recoverQueuedSessions] = await Promise.all([
    prepareOrphanedSessionRecovery(input.deps),
    prepareQueuedSessionRecovery(input.deps),
  ]);
  const stopQueueReadiness = watchSessionQueueReadiness(input.deps, () =>
    createSessionScheduler(input.deps).drainQueue(),
  );
  const startupBackgroundTasks: Promise<void>[] = [input.extensionStartup];
  const startupDone = runStartupTasks(input.deps, startupAbort.signal, {
    recoverOrphanedSessions,
    onBackgroundTask: (task) => {
      startupBackgroundTasks.push(
        task.catch((err) => {
          if (!startupAbort.signal.aborted) {
            apiLogger.error({ err, event: "api.startup.background.error" }, "Startup task failed");
          }
        }),
      );
    },
    recoverQueuedAutomation: async () => {
      await input.automationService.recoverQueuedRuns();
    },
    recoverQueuedSessions,
  }).catch((err) => {
    if (!startupAbort.signal.aborted) apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed");
  });

  return createAppCloser({
    ...input,
    unsubscribeExtensionEvents: () => {
      unsubscribeProjectActivation();
      input.unsubscribeExtensionEvents();
    },
    startupAbort,
    stopQueueReadiness,
    sessionQueueLifecycle: input.deps.sessionQueueLifecycle,
    harnessRegistry: input.deps.harnessRegistry,
    nativeDocuments: input.deps.nativeDocuments,
    startupDone,
    getStartupBackgroundDone: () => Promise.all(startupBackgroundTasks).then(() => undefined),
  });
};
