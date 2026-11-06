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

// Exiting while PGlite is open can corrupt its WAL (lessons 0002 and 0014), so a fatal exit waits
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

const traceShutdownPhase = async <T>(phase: string, close: () => Promise<T>) => {
  const startedAt = performance.now();
  const fields = { event: "runtime.shutdown.phase", phase };
  apiLogger.info({ ...fields, state: "started" }, "Runtime shutdown step started");
  try {
    return await close();
  } finally {
    apiLogger.info(
      { ...fields, state: "settled", duration_ms: Math.round(performance.now() - startedAt) },
      "Runtime shutdown step settled",
    );
  }
};

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
  extensionInstallations: RouteDeps["extensionInstallations"];
  nativeDocuments: Pick<RouteDeps["nativeDocuments"], "dispose">;
  textEditing: Pick<RouteDeps["textEditing"], "dispose">;
}) => {
  let closePromise: Promise<void> | null = null;
  return async () => {
    closePromise ??= (async () => {
      const hooksStopped = traceShutdownPhase("session_hooks", () => input.closeSessionHooks());
      const installationsStopped = traceShutdownPhase("extension_installations", () =>
        input.extensionInstallations.dispose(),
      );
      installationsStopped.catch(() => {});
      const nativeDocumentsStopped = traceShutdownPhase("text_editing", () => input.textEditing.dispose()).finally(() =>
        traceShutdownPhase("native_documents", () => input.nativeDocuments.dispose()),
      );
      try {
        input.startupAbort.abort();
        const queueStopped = traceShutdownPhase("session_queue", () => input.sessionQueueLifecycle.close());
        // A queued startup can need worker disposal to settle. Stop admission first,
        // then begin cleanup before waiting for those dispatches to finish.
        const harnessesStopped = traceShutdownPhase("harnesses", () => input.harnessRegistry.dispose());
        harnessesStopped.catch(() => {});
        await traceShutdownPhase("queue_readiness", () => input.stopQueueReadiness());
        await queueStopped;
        await traceShutdownPhase("startup", () => input.startupDone);
        await traceShutdownPhase("startup_background", () => input.getStartupBackgroundDone());
        await hooksStopped;
        await nativeDocumentsStopped;
        clearInterval(input.notificationWakeTimer);
        input.unsubscribeExtensionEvents();
        await traceShutdownPhase("extension_runtime", () => input.extensionRuntime.dispose());
        await traceShutdownPhase("artifact_mounts", () => input.artifactMountWatch.dispose());
        await traceShutdownPhase("extension_scheduler", () => input.extensionScheduler.dispose());
        await traceShutdownPhase("automation", () => input.automationService.close());
        await traceShutdownPhase("terminals", () => input.terminalSupervisor.dispose());
        await harnessesStopped;
      } finally {
        // A part that fails to stop must not leave PGlite open (lessons 0002 and 0014).
        try {
          await Promise.all([hooksStopped, installationsStopped]);
        } finally {
          try {
            await nativeDocumentsStopped;
          } finally {
            await traceShutdownPhase("database", () => input.closeDb());
          }
        }
      }
    })();
    await closePromise;
  };
};

export const closeAppDatabase = async (
  deps: Pick<RouteDeps, "extensionResourceSequencesService" | "extensionStorageService">,
  closeDb: () => Promise<void>,
) => {
  try {
    await deps.extensionResourceSequencesService.flush();
  } finally {
    try {
      await deps.extensionStorageService.flushStatistics();
    } finally {
      await closeDb();
    }
  }
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

  // Recovered extension selections need every dependency and the closer that stops them.
  input.deps.extensionInstallations.start();
  return createAppCloser({
    ...input,
    // Imports stop while their session and file dependencies are still available.
    closeSessionHooks: async () => {
      const stopped = await Promise.allSettled([input.closeSessionHooks(), input.deps.sessionImports.close()]);
      const failures = stopped.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (failures.length) throw new AggregateError(failures, "Could not stop all session services");
    },
    unsubscribeExtensionEvents: () => {
      unsubscribeProjectActivation();
      input.unsubscribeExtensionEvents();
    },
    startupAbort,
    stopQueueReadiness,
    sessionQueueLifecycle: input.deps.sessionQueueLifecycle,
    harnessRegistry: input.deps.harnessRegistry,
    extensionInstallations: input.deps.extensionInstallations,
    nativeDocuments: input.deps.nativeDocuments,
    textEditing: input.deps.textEditing,
    startupDone,
    getStartupBackgroundDone: () => Promise.all(startupBackgroundTasks).then(() => undefined),
  });
};
