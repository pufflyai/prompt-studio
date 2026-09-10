import { expect, test } from "bun:test";
import { createDb, createSettingsDBService } from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createSettingsService } from "./settings-service";
import { createSyncService } from "./sync-service";

test("publishes confirmed settings and restores them in a new sync snapshot", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const settingsDb = createSettingsDBService(connection.db);
    const eventBus = new EventBus();
    let capacityChecks = 0;
    const settings = createSettingsService({
      settingsDb,
      eventBus,
      onCapacityAvailable: async () => {
        capacityChecks++;
      },
    });
    const sync = createSyncService({ db: connection.db, eventBus });
    await settings.get();
    expect((await sync.getFullState()).settings).toEqual([
      expect.objectContaining({ id: "global", notifications_enabled: false }),
    ]);
    const events: unknown[] = [];
    const unsubscribe = eventBus.subscribe((event) => events.push(event));
    await settings.update({ notifications_enabled: true });
    expect(capacityChecks).toBe(0);
    expect(events).toContainEqual(
      expect.objectContaining({
        table: "settings",
        op: "set",
        data: expect.objectContaining({ id: "global", notifications_enabled: true }),
      }),
    );
    expect((await sync.getFullState()).settings).toEqual([
      expect.objectContaining({ id: "global", notifications_enabled: true }),
    ]);
    await settings.update({ max_concurrent_sessions: 2 });
    expect(capacityChecks).toBe(1);
    expect(await settings.get()).toEqual({ notifications_enabled: true, max_concurrent_sessions: 2 });
    unsubscribe();
  } finally {
    await connection.close();
  }
});
