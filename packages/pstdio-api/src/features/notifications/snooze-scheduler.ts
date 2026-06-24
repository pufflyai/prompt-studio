import { apiLogger } from "../../lib/logger";
import type { NotificationsRouteDeps } from "./deps";
import { wakeDueSnoozed } from "./notifications-service";

const DEFAULT_INTERVAL_MS = 30_000;

export const createSnoozeWakeUpScheduler = (deps: NotificationsRouteDeps, options: { intervalMs?: number } = {}) => {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const count = await wakeDueSnoozed(deps);
      if (count > 0) {
        apiLogger.info({ event: "notifications.snooze_wakeup", count }, "Woke due snoozed notifications");
      }
    } catch (err) {
      apiLogger.error({ err, event: "notifications.snooze_wakeup.error" }, "Snooze wake-up tick failed");
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => void tick(), intervalMs);
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tick,
  };
};
