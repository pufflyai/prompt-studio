import { createLogger, resolveDefaultLogPath } from "pstdio-logging";

const rootLoggers = new Map<string, ReturnType<typeof createLogger>>();

const resolveRootLogger = () => {
  const logPath = resolveDefaultLogPath();
  const existing = rootLoggers.get(logPath);
  if (existing) {
    return existing;
  }

  const created = createLogger({ service: "pstdio-api", sync: true });
  rootLoggers.set(logPath, created);
  return created;
};

const forComponent = (component: string) => ({
  error: (data: Record<string, unknown>, message?: string) => {
    const logger = resolveRootLogger().child({ component });
    if (message === undefined) {
      logger.error(data);
      return;
    }
    logger.error(data, message);
  },
  info: (data: Record<string, unknown>, message?: string) => {
    const logger = resolveRootLogger().child({ component });
    if (message === undefined) {
      logger.info(data);
      return;
    }
    logger.info(data, message);
  },
  warn: (data: Record<string, unknown>, message?: string) => {
    const logger = resolveRootLogger().child({ component });
    if (message === undefined) {
      logger.warn(data);
      return;
    }
    logger.warn(data, message);
  },
});

export const apiLogger = forComponent("api");
export const sessionLogger = forComponent("sessions");
