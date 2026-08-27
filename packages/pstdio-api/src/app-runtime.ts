import { join } from "node:path";
import { sessionEvents } from "pstdio-api-contracts/extension-kernel";
import type { RouteDeps } from "./features/deps";
import { createExtensionScheduler } from "./features/extensions/extension-scheduler";
import { createTerminalSupervisor } from "./features/extensions/extension-terminal-runtime";
import type { RuntimeHost } from "./features/runtime/routes";
import { createSessionScheduler } from "./features/sessions/session-scheduler";
import { apiLogger } from "./lib/logger";
import type { createNotificationService } from "./services/notification-service";
import type { createProjectService } from "./services/project-service";
import type { createSessionService } from "./services/session-service";
import { runStartupTasks } from "./startup";

const EXTENSION_SCHEDULE_WATERMARK_FILE = "extension-schedule-watermarks.json";

export const sessionStatusEventFor = (status: string) => {
  if (status === "awaiting_input") return sessionEvents.awaitingInput;
  if (status === "completed") return sessionEvents.succeeded;
  if (status === "failed") return sessionEvents.failed;
  return null;
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
    activity: async () => ({
      sessions: await activeSessions(),
      terminals: input.terminalSupervisor.activity(),
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

const createAppCloser = (input: {
  startupAbort: AbortController;
  startupDone: Promise<void>;
  getStartupBackgroundDone: () => Promise<void>;
  notificationWakeTimer: ReturnType<typeof setInterval>;
  unsubscribeExtensionEvents: () => void;
  extensionRuntime: { dispose(): void };
  extensionScheduler: { dispose(): Promise<void> };
  automationService: { close(): Promise<void> };
  terminalSupervisor: { dispose(): Promise<void> };
  closeDb: () => Promise<void>;
}) => {
  let closePromise: Promise<void> | null = null;
  return async () => {
    closePromise ??= (async () => {
      input.startupAbort.abort();
      await input.startupDone;
      await input.getStartupBackgroundDone();
      clearInterval(input.notificationWakeTimer);
      input.unsubscribeExtensionEvents();
      input.extensionRuntime.dispose();
      await input.extensionScheduler.dispose();
      await input.automationService.close();
      await input.terminalSupervisor.dispose();
      await input.closeDb();
    })();
    await closePromise;
  };
};

export const startAppLifecycle = async (input: {
  deps: RouteDeps;
  notificationWakeTimer: ReturnType<typeof setInterval>;
  unsubscribeExtensionEvents: () => void;
  extensionRuntime: { dispose(): void };
  extensionScheduler: { dispose(): Promise<void> };
  automationService: Pick<RouteDeps["automationService"], "close" | "recoverQueuedRuns">;
  terminalSupervisor: { dispose(): Promise<void> };
  closeDb: () => Promise<void>;
}) => {
  const startupAbort = new AbortController();
  const startupBackgroundTasks: Promise<void>[] = [];
  const startupDone = runStartupTasks(input.deps, startupAbort.signal, {
    onBackgroundTask: (task) => {
      startupBackgroundTasks.push(
        task.catch((err) => apiLogger.error({ err, event: "api.startup.background.error" }, "Startup task failed")),
      );
    },
    recoverQueuedAutomation: async () => {
      await input.automationService.recoverQueuedRuns();
    },
    recoverQueuedSessions: () => createSessionScheduler(input.deps).recoverQueuedSessions(),
  }).catch((err) => apiLogger.error({ err, event: "api.startup.error" }, "Startup task failed"));
  await startupDone;

  return createAppCloser({
    ...input,
    startupAbort,
    startupDone,
    getStartupBackgroundDone: () => Promise.all(startupBackgroundTasks).then(() => undefined),
  });
};
