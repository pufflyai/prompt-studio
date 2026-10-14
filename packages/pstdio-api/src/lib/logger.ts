import { createLogger, resolveDefaultLogPath } from "pstdio-logging";

const rootLoggers = new Map<string, ReturnType<typeof createLogger>>();

const resolveLoggerBase = () => {
  const autostartId = process.env.PSTDIO_AUTOSTART_ID;
  return autostartId ? { autostartId } : undefined;
};

const resolveRootLogger = () => {
  const logPath = resolveDefaultLogPath();
  const existing = rootLoggers.get(logPath);
  if (existing) {
    return existing;
  }

  const created = createLogger({ base: resolveLoggerBase(), service: "pstdio-api", sync: true });
  rootLoggers.set(logPath, created);
  return created;
};

const forComponent = (component: string, level?: string) => {
  const options = level ? { level } : undefined;
  return {
    error: (data: Record<string, unknown>, message?: string) => {
      const logger = resolveRootLogger().child({ component }, options);
      if (message === undefined) {
        logger.error(data);
        return;
      }
      logger.error(data, message);
    },
    info: (data: Record<string, unknown>, message?: string) => {
      const logger = resolveRootLogger().child({ component }, options);
      if (message === undefined) {
        logger.info(data);
        return;
      }
      logger.info(data, message);
    },
    warn: (data: Record<string, unknown>, message?: string) => {
      const logger = resolveRootLogger().child({ component }, options);
      if (message === undefined) {
        logger.warn(data);
        return;
      }
      logger.warn(data, message);
    },
  };
};

export const apiLogger = forComponent("api");
export const sessionLogger = forComponent("sessions");
// Startup steps are written at every log level, like desktop lifecycle events, so the log of a
// slow or failed launch shows how far it got.
export const startupLogger = forComponent("startup", "info");
// A setup stall needs its last entered step even when ordinary request logs are disabled.
export const setupLogger = forComponent("setup", "info");
